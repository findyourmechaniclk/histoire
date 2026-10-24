import { createHistoireSessionWithAdapters } from '@histoire/sdk/internal'
import { HistoireProvider } from '@histoire/vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h, nextTick, onBeforeUnmount, ref, watchEffect } from 'vue'
import CanvasFrame from '../../../histoire-app/src/app/components/canvas/CanvasFrame.vue'
import CanvasViewport from '../../../histoire-app/src/app/components/canvas/CanvasViewport.vue'
import MatrixView from '../../../histoire-app/src/app/components/canvas/matrix/MatrixView.vue'
import { createMatrixStore, provideMatrix } from '../../../histoire-app/src/app/stores/matrix.js'
import { createStoryCanvasViews, provideStoryCanvasViews } from '../../../histoire-app/src/app/stores/story-canvas-views.js'
import { sourceFixture } from '../../../histoire-sdk/src/__tests__/fixtures/session.js'
import { resizeObserverFixture } from './fixtures/resize-observer.js'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Mount Grid and Matrix in one viewport, recording the most Matrix cells ever live at once. */
async function budgetFixture(frameBudget: number) {
  resizeObserverFixture()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const [width, height] = this.classList.contains('histoire-canvas-viewport') ? [1800, 1000] : [0, 0]
    return { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }
  })
  const source = sourceFixture()
  const session = createHistoireSessionWithAdapters({ url: 'https://book.example/' }, source.adapters)
  await session.connect()
  await session.selection.select({ storyId: 'a:b', variantId: 'c' })
  const matrix = createMatrixStore()
  const arrange = ref<'grid' | 'matrix'>('grid')
  const liveCells = new Set<string>()
  let peak = 0
  const MatrixCellProbe = defineComponent({
    props: { cell: { type: Object, required: true }, live: Boolean },
    setup(props) {
      const key = (props.cell as { key: string }).key
      watchEffect(() => {
        if (props.live) liveCells.add(key)
        else liveCells.delete(key)
        peak = Math.max(peak, liveCells.size)
      }, { flush: 'sync' })
      onBeforeUnmount(() => liveCells.delete(key))
      return () => h('div')
    },
  })
  const Host = defineComponent({
    setup() {
      provideMatrix(matrix)
      provideStoryCanvasViews(createStoryCanvasViews())
      return () => h(CanvasViewport, { arrange: arrange.value, previewBase: 'https://book.example/', frameBudget }, {
        matrix: slot => h(MatrixView, { size: slot.size, contentInsets: slot.contentInsets, previewBase: 'https://book.example/' }),
      })
    },
  })
  const wrapper = mount(HistoireProvider, {
    props: { session },
    attachTo: document.body,
    slots: { default: () => h(Host) },
    global: { stubs: { CanvasFrame: true, MatrixCell: MatrixCellProbe, MatrixAxisBar: true } },
  })
  onTestFinished(async () => {
    wrapper.unmount()
    wrapper.element.remove()
    matrix.close()
    await session.dispose()
  })
  await flushPromises()
  return { wrapper, matrix, arrange, liveCells, peak: () => peak }
}

describe('viewport frame budget', () => {
  it('counts the hidden Matrix primary against the budget from the first Matrix render', async () => {
    const test = await budgetFixture(3)
    expect(test.wrapper.findAllComponents(CanvasFrame).filter(frame => frame.props('live'))).toHaveLength(2)
    test.matrix.activate('a:b', [{ name: 'enabled', values: [false, true] }, { name: 'active', values: [false, true] }], {})
    test.arrange.value = 'matrix'
    await nextTick()
    await flushPromises()
    expect(test.liveCells.size).toBe(2)
    expect(test.peak()).toBe(2)
  })
})
