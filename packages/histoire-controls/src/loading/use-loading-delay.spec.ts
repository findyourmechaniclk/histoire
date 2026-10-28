import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useLoadingDelay } from './use-loading-delay.js'

afterEach(() => vi.useRealTimers())

it('delays visible loading while keeping the actual busy state immediate and cancels on unmount', async () => {
  vi.useFakeTimers()
  const pending = ref(true)
  const component = defineComponent({
    setup() {
      const visible = useLoadingDelay(pending)
      return () => h('div', { 'aria-busy': pending.value }, visible.value ? 'Loading' : '')
    },
  })
  const wrapper = mount(component)
  expect(wrapper.attributes('aria-busy')).toBe('true')
  expect(wrapper.text()).toBe('')
  await vi.advanceTimersByTimeAsync(99)
  expect(wrapper.text()).toBe('')
  await vi.advanceTimersByTimeAsync(1)
  expect(wrapper.text()).toBe('Loading')
  pending.value = false
  await nextTick()
  expect(wrapper.text()).toBe('')
  pending.value = true
  wrapper.unmount()
  await vi.advanceTimersByTimeAsync(100)
  expect(vi.getTimerCount()).toBe(0)
})

it('restarts the delay when one pending operation replaces another', async () => {
  vi.useFakeTimers()
  const identity = ref('first')
  const component = defineComponent({
    setup() {
      const visible = useLoadingDelay(true, identity)
      return () => h('div', visible.value ? 'Loading' : '')
    },
  })
  const wrapper = mount(component)
  await vi.advanceTimersByTimeAsync(80)
  identity.value = 'second'
  await vi.advanceTimersByTimeAsync(99)
  expect(wrapper.text()).toBe('')
  await vi.advanceTimersByTimeAsync(1)
  expect(wrapper.text()).toBe('Loading')
  wrapper.unmount()
})
