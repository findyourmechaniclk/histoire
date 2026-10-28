import type { MaybeRefOrGetter, Ref } from 'vue'
import { createLoadingDelay } from '@histoire/shared/loading-delay'
import { computed, inject, onScopeDispose, ref, toValue, watch } from 'vue'
import { LOADING_DELAY_ELAPSED } from './LoadingDelayBoundary.js'

/**
 * Delays a loading presentation while leaving the source state unchanged.
 * @param pending Actual pending state.
 * @param identity Changes when a pending operation is replaced.
 */
export function useLoadingDelay(pending: MaybeRefOrGetter<boolean>, identity?: MaybeRefOrGetter<unknown>): Ref<boolean> {
  if (inject(LOADING_DELAY_ELAPSED, false)) return computed(() => toValue(pending))
  const visible = ref(false)
  const delay = createLoadingDelay(value => visible.value = value)
  watch([() => toValue(pending), () => toValue(identity)], ([value, key], previous) => {
    if (value && previous?.[0] && key !== previous[1]) delay.setPending(false)
    delay.setPending(value)
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(delay.dispose)
  return visible
}
