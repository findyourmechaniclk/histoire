/** Style ownership per document and plugin, shared by every extension host. */
const styles = new WeakMap<Document, Map<string, { element: HTMLStyleElement, users: number }>>()

/** Install compiled, plugin-scoped stylesheet until final host releases it. */
export function installPluginStyles(document: Document, id: string, css: string, signal: AbortSignal): void {
  if (signal.aborted) return
  let installed = styles.get(document)
  if (!installed) styles.set(document, installed = new Map())
  let entry = installed.get(id)
  if (!entry) {
    const element = document.createElement('style')
    element.dataset.histoirePlugin = id
    element.textContent = css
    document.head.append(element)
    installed.set(id, entry = { element, users: 0 })
  }
  entry.users++
  signal.addEventListener('abort', () => {
    if (!--entry!.users) {
      entry!.element.remove()
      installed!.delete(id)
    }
  }, { once: true })
}
