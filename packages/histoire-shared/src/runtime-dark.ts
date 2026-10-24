/** Subscribes a listener to dark mode: calls it now, then on change; returns cleanup. */
export type HistoireDarkSource = (listener: (dark: boolean) => void) => () => void

/** Dark mode owned by the Histoire runtime of this story document, if loaded. */
let source: HistoireDarkSource | undefined

/**
 * Histoire's runtime registers its dark mode here, so story framework hosts
 * can follow it without depending on the runtime itself.
 */
export function registerHistoireDarkSource(value: HistoireDarkSource): () => void {
  source = value
  return () => {
    if (source === value) source = undefined
  }
}

/**
 * Calls `listener` with Histoire's dark mode, then on every change. Without a
 * Histoire runtime (story collection, unit tests) it is never called.
 * @returns Function stopping the subscription.
 */
export function onHistoireDarkChange(listener: (dark: boolean) => void): () => void {
  return source?.(listener) ?? (() => {})
}
