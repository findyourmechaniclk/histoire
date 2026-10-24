/** How long an issue highlight stays visible. */
const HIGHLIGHT_MS = 1600

/** Pending restore of each highlighted element, so a repeated highlight never keeps its own outline. */
const active = new WeakMap<Element, () => void>()

/**
 * Outlines one element of the rendered variant for a moment, restoring its inline styles
 * afterwards or as soon as `signal` aborts (actor detached).
 * @param element Element to outline.
 * @param signal Actor lifetime.
 */
export function highlightElement(element: Element, signal: AbortSignal): void {
  if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) return
  active.get(element)?.()
  const { outline, outlineOffset } = element.style
  element.style.outline = '2px solid #e11d48'
  element.style.outlineOffset = '2px'
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  let timer: ReturnType<typeof setTimeout> | undefined
  const restore = () => {
    clearTimeout(timer)
    signal.removeEventListener('abort', restore)
    active.delete(element)
    element.style.outline = outline
    element.style.outlineOffset = outlineOffset
  }
  timer = setTimeout(restore, HIGHLIGHT_MS)
  active.set(element, restore)
  signal.addEventListener('abort', restore, { once: true })
}
