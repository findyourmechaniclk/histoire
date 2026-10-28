import { HstPulsatingDisc, LoadingDelayBoundary } from '@histoire/controls/vue'
import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import WorkbenchLoadingSkeleton from '../../../histoire-app/src/app/components/shell/WorkbenchLoadingSkeleton.vue'
import WorkbenchLoadingState from '../../../histoire-app/src/app/components/shell/WorkbenchLoadingState.vue'

const state = ref<'loading' | 'ready' | 'error'>('loading')
const Panel = defineComponent({
  setup() {
    return () => h('section', { 'aria-busy': state.value === 'loading' }, state.value === 'loading'
      ? h(WorkbenchLoadingState, { title: 'Loading data' })
      : state.value === 'error' ? h('p', { role: 'alert' }, 'Failed') : h('p', 'Ready'))
  },
})

afterEach(() => vi.useRealTimers())

it('never flashes on a quick load and shows failures immediately', async () => {
  vi.useFakeTimers()
  state.value = 'loading'
  const wrapper = mount(Panel)
  expect(wrapper.attributes('aria-busy')).toBe('true')
  expect(wrapper.text()).toBe('')
  await vi.advanceTimersByTimeAsync(99)
  state.value = 'error'
  await nextTick()
  expect(wrapper.find('[role="alert"]').text()).toBe('Failed')
  await vi.advanceTimersByTimeAsync(100)
  expect(wrapper.text()).toBe('Failed')
  wrapper.unmount()
})

it('shows panel and disc together after one delay and clears them immediately', async () => {
  vi.useFakeTimers()
  state.value = 'loading'
  const wrapper = mount(Panel)
  await vi.advanceTimersByTimeAsync(100)
  expect(wrapper.get('[role="status"]').text()).toBe('Loading data')
  expect(wrapper.findComponent(HstPulsatingDisc).element instanceof HTMLElement).toBe(true)
  state.value = 'ready'
  await nextTick()
  expect(wrapper.text()).toBe('Ready')
  wrapper.unmount()
})

it('delays a controls skeleton but does not delay an already-gated slot twice', async () => {
  vi.useFakeTimers()
  const delayed = mount(WorkbenchLoadingSkeleton)
  const gated = mount(defineComponent(() => () => h(LoadingDelayBoundary, null, () => h(WorkbenchLoadingSkeleton))))
  expect(delayed.find('[role="status"]').exists()).toBe(false)
  expect(gated.get('[role="status"]').attributes('aria-label')).toBe('Loading')
  await vi.advanceTimersByTimeAsync(100)
  expect(delayed.get('[role="status"]').attributes('aria-label')).toBe('Loading')
  delayed.unmount()
  gated.unmount()
})
