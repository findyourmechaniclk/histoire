// Inlined at build time (`?inline`), so consumers need no CSS pipeline for this package.
import css from '../styles.css?inline'

/** Hosts currently using the shared style element. */
let users = 0
/** Shared style element, present while at least one host uses it. */
let element: HTMLStyleElement | undefined

/**
 * Adds the plugin stylesheet to the document until `signal` aborts. Reference-counted, so two
 * workbenches on one page share a single element and the last one removes it.
 * @param signal Plugin lifetime (`api.signal`).
 */
export function installReferenceStyles(signal: AbortSignal): void {
  if (signal.aborted) return
  if (!users++) {
    element = document.createElement('style')
    element.dataset.histoirePlugin = 'reference'
    element.textContent = css
    document.head.append(element)
  }
  signal.addEventListener('abort', () => {
    if (!--users) {
      element?.remove()
      element = undefined
    }
  }, { once: true })
}
