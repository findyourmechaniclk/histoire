import type { CanvasViewInput, WorkbenchPluginApi } from '../../../../histoire-plugin-kit/src/index.js'
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { bindStoryCanvasView } from '../../../../histoire-app/src/app/components/canvas/story-view-binding.js'
import { useContributionLookup } from '../../../../histoire-app/src/app/composables/shell-extensions.js'
import { createWorkbenchArrangement } from '../../../../histoire-app/src/app/standalone/arrangement.js'
import { createCanvasStore } from '../../../../histoire-app/src/app/stores/canvas.js'
import { createStoryCanvasViews } from '../../../../histoire-app/src/app/stores/story-canvas-views.js'
import { flushMicrotasks } from './utils/flush.js'
import { deferred } from './utils/mcp/deferred.js'
import { memoryStorage } from './utils/settings-storage.js'
import { createTestWorkbenchHost, pluginEntry } from './utils/workbench-extensions.js'

const resources: (() => unknown)[] = []
afterEach(async () => {
  await Promise.all(resources.splice(0).reverse().map(close => close()))
})

/** Canvas view registered by the `acme` plugin. */
const compare: CanvasViewInput = { id: 'compare', label: 'Compare', icon: 'compare', mount: () => {} }

/**
 * Workbench arrangement for story `a:b` (declared List layout) backed by a real extension host.
 * @param options Route value, plugin setup and optional pending plugin import.
 * @param options.query `?arrange=` value.
 * @param options.setup Plugin setup.
 * @param options.load Pending plugin import.
 */
function arrangementFixture(options: { query?: unknown, setup?: (api: WorkbenchPluginApi) => void, load?: () => Promise<{ default: unknown }> } = {}) {
  const definition = { id: 'acme', apiVersion: 1 as const, setup: options.setup ?? (() => {}) }
  const { workbench } = createTestWorkbenchHost({ plugins: [pluginEntry(definition, options.load)] })
  const query = ref(options.query)
  const views = createStoryCanvasViews()
  const scope = effectScope()
  const state = scope.run(() => createWorkbenchArrangement({
    query: () => query.value,
    storyId: () => 'a:b',
    storyLayout: () => 'list',
    localDefault: () => undefined,
    projectDefault: () => undefined,
    syncZoom: () => false,
    views,
    canvasViews: useContributionLookup('canvas.view', workbench),
  }))!
  resources.push(() => scope.stop(), () => workbench.dispose())
  return { workbench, definition, query, views, state }
}

describe('custom canvas view arrangement', () => {
  it('keeps a plugin view deep link while plugins load, then falls back once it is missing', async () => {
    const load = deferred<{ default: unknown }>()
    const test = arrangementFixture({ query: 'acme:compare', load: () => load.promise })
    expect(test.state.arrangement.value).toBe('acme:compare')
    expect(test.state.override.value).toBe(true)
    // Setup settles without the requested view: the route value now behaves like any unknown value.
    load.resolve({ default: test.definition })
    await test.workbench.host.ready
    await flushMicrotasks()
    expect(test.state.arrangement.value).toBe('list')
    expect(test.state.override.value).toBe(false)
  })

  it('opens a registered plugin view from the route and falls back when it is removed', async () => {
    let remove = () => {}
    const test = arrangementFixture({ query: 'acme:compare', setup: (api) => {
      remove = api.canvas.addView(compare)
    } })
    await test.workbench.host.ready
    await flushMicrotasks()
    expect(test.state.arrangement.value).toBe('acme:compare')
    remove()
    await flushMicrotasks()
    expect(test.state.arrangement.value).toBe('list')
  })

  it('restores a remembered plugin view per story and ignores it once the view is gone', async () => {
    let remove = () => {}
    const test = arrangementFixture({ setup: (api) => {
      remove = api.canvas.addView(compare)
    } })
    await test.workbench.host.ready
    test.views.saveStory('a:b', { arrangement: 'acme:compare', zoomByArrange: { 'single': 'fit', 'grid': 1, 'list': 'selection', 'matrix': 'fit', 'acme:compare': 0.5 }, panOffset: { x: 4, y: 8 } })
    expect(test.state.arrangement.value).toBe('acme:compare')
    expect(test.views.getStory('a:b')?.zoomByArrange['acme:compare']).toBe(0.5)
    remove()
    await flushMicrotasks()
    expect(test.state.arrangement.value).toBe('list')
  })
})

describe('custom canvas view camera', () => {
  it('remembers zoom per plugin view, falls back to Fit, and persists well-formed view keys only', () => {
    const storage = memoryStorage()
    storage.setItem('_histoire-ui-canvas', JSON.stringify({ version: 3, zoomByArrange: { 'grid': 1, 'acme:compare': 0.75, 'acme:broken': 'nope', 'bogus': 2 } }))
    const canvas = createCanvasStore({ storage })
    expect(canvas.zoomByArrange['acme:compare']).toBe(0.75)
    expect(canvas.zoomByArrange['acme:broken']).toBeUndefined()
    expect('bogus' in canvas.zoomByArrange).toBe(false)
    canvas.setArrangement('acme:other')
    expect(canvas.zoom).toBe('fit')
    canvas.setArrangement('acme:compare')
    expect(canvas.zoom).toBe(0.75)
    expect(canvas.effectiveZoom).toBe(0.75)
    canvas.setZoom(0.5)
    expect(createCanvasStore({ storage }).zoomByArrange['acme:compare']).toBe(0.5)
  })

  it('fits a view through its layout and leaves the camera alone for views without one', () => {
    const canvas = createCanvasStore()
    canvas.setArrangement('acme:compare')
    canvas.setGeometry({ width: 800, height: 600 }, { x: 0, y: 0, width: 1600, height: 400 })
    expect(canvas.effectiveZoom).toBeLessThan(1)
    canvas.setArrangement('acme:free')
    canvas.setZoom(2)
    const pan = { ...canvas.panOffset }
    canvas.setGeometry({ width: 800, height: 600 }, undefined)
    canvas.fit()
    expect(canvas.effectiveZoom).toBe(2)
    expect(canvas.panOffset).toEqual(pan)
  })

  it('restores the plugin view zoom from a story view snapshot', async () => {
    const storyId = ref('first')
    const views = createStoryCanvasViews()
    views.saveStory('second', { arrangement: 'acme:compare', zoomByArrange: { 'single': 'fit', 'grid': 1, 'list': 'selection', 'matrix': 'fit', 'acme:compare': 0.4 }, panOffset: { x: 4, y: 8 } })
    const canvas = createCanvasStore()
    const binding = bindStoryCanvasView({ getStoryId: () => storyId.value, getArrangement: () => 'acme:compare', getRenderedArrangement: () => 'acme:compare', getBaseArrangement: () => 'grid', hasArrangementOverride: () => false, getSyncZoom: () => false, canvas, views })
    resources.push(() => binding.dispose())
    storyId.value = 'second'
    await nextTick()
    expect(canvas.arrangement).toBe('acme:compare')
    expect(canvas.zoom).toBe(0.4)
    expect(canvas.effectiveZoom).toBe(0.4)
  })
})
