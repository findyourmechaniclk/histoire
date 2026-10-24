import type { ReferenceModel } from '../domain/model.js'
import { useEffect, useReducer } from 'react'
import { subscribeViewState } from '../domain/view-state.js'

/**
 * Re-renders the calling component whenever the framework-free model changes; view state is then
 * computed during render from the model and the latest `context` prop.
 * @param model Plugin state.
 */
export function useModel(model: ReferenceModel): void {
  const [, rerender] = useReducer((count: number) => count + 1, 0)
  useEffect(() => subscribeViewState(model, rerender), [model])
}
