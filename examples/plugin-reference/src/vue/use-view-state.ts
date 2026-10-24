import type { ReferenceModel } from '../domain/model.js'
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { subscribeViewState } from '../domain/view-state.js'

/**
 * Derives view state from the framework-free model. The model is not reactive, so a counter
 * bumped by its subscription invalidates the computed; reactive reads inside `read` (props,
 * `useWorkbenchContext()`) invalidate it too.
 * @param model Plugin state.
 * @param read Computes the state.
 */
export function useViewState<T>(model: ReferenceModel, read: () => T) {
  const version = shallowRef(0)
  const stop = subscribeViewState(model, () => version.value++)
  onBeforeUnmount(stop)
  return computed(() => {
    void version.value
    return read()
  })
}
