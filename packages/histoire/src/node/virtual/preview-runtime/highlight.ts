/** Owns one non-interactive temporary overlay in a story document. */
export function createRuntimeHighlight(document: Document, window: Window) {
  let nextLease = 0
  let current: { element: HTMLElement, requestId: string, leaseId: string, kind: 'highlight' | 'highlightLease', component: boolean, owner: string, cleanup: () => void } | undefined
  /** Remove only the captured overlay, never a successor. */
  function remove(entry: NonNullable<typeof current>) {
    entry.cleanup()
    entry.element.remove()
    if (current === entry) current = undefined
  }
  /** Install only a connected element belonging to the authorized root. */
  function showTarget(root: Element, target: Element | null, duration: number, requestId: string, owner: unknown, kind: 'highlight' | 'highlightLease', component: boolean, isActive?: () => boolean) {
    if (!target || !target.isConnected || target.ownerDocument !== document || !root.contains(target)) throw Object.assign(new Error('Highlight target unavailable'), { code: 'PREVIEW_NOT_READY' })
    if (current) remove(current)
    const element = document.createElement('div')
    element.setAttribute('data-histoire-inspection-highlight', '')
    element.setAttribute('aria-hidden', 'true')
    element.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;background:rgba(79,125,255,.18);'
    let timer = 0
    let frame = 0
    let checkedAt = window.performance.now()
    const leaseId = window.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${++nextLease}-${Math.random().toString(36).slice(2)}`
    const entry = { element, requestId, leaseId, kind, component, owner: JSON.stringify(owner), cleanup: () => {
      window.clearTimeout(timer)
      window.cancelAnimationFrame(frame)
    } }
    /** Geometry follows layout changes and disappears with its captured target. */
    function position() {
      if (current !== entry) return
      if (!target!.isConnected || !root.isConnected || !root.contains(target)) {
        remove(entry)
        return
      }
      // Vue can retain a leaving element after its component leaves the active tree.
      // Limit bounded tree revalidation to ten times per second.
      if (isActive && window.performance.now() - checkedAt >= 100) {
        checkedAt = window.performance.now()
        let active = false
        try {
          active = isActive()
        }
        catch { /* Failed ownership checks retire this entry. */ }
        if (current !== entry) return
        if (!active) {
          remove(entry)
          return
        }
      }
      let rect: DOMRect
      try {
        rect = target!.getBoundingClientRect()
      }
      catch {
        remove(entry)
        return
      }
      if (current !== entry) return
      Object.assign(element.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
    }
    timer = window.setTimeout(() => remove(entry), duration)
    current = entry
    document.body.append(element)
    /** The timer bounds observation; stale callbacks cannot update a successor. */
    function follow() {
      position()
      if (current === entry) frame = window.requestAnimationFrame(follow)
    }
    frame = window.requestAnimationFrame(follow)
    position()
    return leaseId
  }
  return {
    /** Display a bounded selector highlight inside the already-authorized root. */
    show(root: Element, selector: string, duration: number, requestId: string, owner: unknown, kind: 'highlight' | 'highlightLease' = 'highlight') {
      let target: Element | null
      try {
        target = root.matches(selector) ? root : root.querySelector(selector)
      }
      catch { throw Object.assign(new Error('Invalid inspection CSS selector'), { code: 'INVALID_SELECTOR' }) }
      return showTarget(root, target, duration, requestId, owner, kind, false)
    },
    /** An internal framework provider supplies the element, never the caller. */
    showElement(root: Element, target: Element, duration: number, requestId: string, owner: unknown, kind: 'highlight' | 'highlightLease' = 'highlight', isActive?: () => boolean) {
      return showTarget(root, target, duration, requestId, owner, kind, true, isActive)
    },
    /** Cancellation cannot remove a later request's overlay. */
    cancel(requestId: string, owner: unknown) {
      if (current?.requestId === requestId && current.owner === JSON.stringify(owner)) remove(current)
    },
    /** A stale lease cannot remove a newer overlay or another connection's work. */
    clear(leaseId: string, owner: unknown) {
      if (!current || current.leaseId !== leaseId || current.owner !== JSON.stringify(owner)) return false
      remove(current)
      return true
    },
    /** Source permission withdrawal retires only the affected overlay kind. */
    revoke(allowed: { highlight?: boolean, highlightLease?: boolean, componentHighlight?: boolean }) {
      if (current && (!allowed[current.kind] || (current.component && (!allowed.componentHighlight || !allowed.highlight)))) remove(current)
    },
    /** Document and actor retirement remove only their currently owned overlay. */
    close() { if (current) remove(current) },
  }
}
