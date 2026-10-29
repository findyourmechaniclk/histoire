/** Temporary background overlay; story element styles and focus stay untouched. */
export function createHighlighter(root: HTMLElement, signal: AbortSignal) {
  let overlay: HTMLDivElement | undefined
  let target: Element | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const document = root.ownerDocument
  const window = document.defaultView!

  /** Drop previous target and every owned resource. */
  function clear(): void {
    clearTimeout(timer)
    overlay?.remove()
    overlay = undefined
    target = undefined
    window.removeEventListener('scroll', position, true)
    window.removeEventListener('resize', position)
  }

  /** Follow current element without affecting document flow or hit testing. */
  function position(): void {
    if (!overlay || !target) return
    if (!target.isConnected || !root.contains(target)) return clear()
    const rect = target.getBoundingClientRect()
    Object.assign(overlay.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
  }

  signal.addEventListener('abort', clear, { once: true })
  return {
    clear,
    /** Show exact retained element; stale or foreign references are rejected. */
    show(element: Element | undefined): boolean {
      clear()
      if (signal.aborted || !element?.isConnected || !root.contains(element)) return false
      target = element
      element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
      overlay = document.createElement('div')
      overlay.dataset.histoireA11yHighlight = ''
      overlay.setAttribute('aria-hidden', 'true')
      Object.assign(overlay.style, { position: 'fixed', pointerEvents: 'none', zIndex: '2147483647', background: 'rgba(99, 102, 241, 0.18)', borderRadius: '4px' })
      // Outside audited root: overlay cannot trigger observer or contaminate axe results.
      document.body.append(overlay)
      position()
      window.addEventListener('scroll', position, true)
      window.addEventListener('resize', position)
      timer = setTimeout(clear, 1600)
      return true
    },
  }
}
