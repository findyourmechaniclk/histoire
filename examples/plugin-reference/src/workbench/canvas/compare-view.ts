import type { CanvasViewContext, CanvasViewInput, FrameLeaseError, MountView, ViewHost } from '@histoire/plugin-kit'
import type { HistoireRect } from '@histoire/protocol'
import type { ReferenceModel } from '../../domain/model.js'
import { h } from '../../dom/h.js'
import { issueCount } from '../../domain/format.js'

/** Column geometry in canvas units. */
const FRAME = { width: 360, height: 260 }
const LABEL_HEIGHT = 28
const GAP = 40
/** Columns compared at once; more variants than this are left out. */
const MAX_COLUMNS = 6

/**
 * Canvas-space box of one column (label plus frame).
 * @param index Column index.
 */
function columnRect(index: number): HistoireRect {
  return { x: index * (FRAME.width + GAP), y: 0, width: FRAME.width, height: LABEL_HEIGHT + FRAME.height }
}

/**
 * Whether a lease failure only means the lease was released first (view switched, story changed).
 * @param error Rejection of `acquireFrame` or `ready`.
 */
function isReleased(error: unknown): boolean {
  return (error as FrameLeaseError)?.name === 'FrameLeaseError' && (error as FrameLeaseError).reason === 'released'
}

/**
 * Renders the selected story's variants side by side in leased frames.
 *
 * Every load owns an `AbortController` linked to the view's lifetime: aborting it releases
 * that load's leases (granted or still queued), so switching story or view never leaks frames.
 * @param container Host-owned view container.
 * @param initial First canvas-scoped context.
 * @param host View host services.
 * @param model Plugin state.
 * @param columns Receives the column count, read by the view's `layout` for Fit.
 */
function mountCompare(container: HTMLElement, initial: CanvasViewContext, host: ViewHost, model: ReferenceModel, columns: (count: number) => void) {
  let context = initial
  const layer = h('div', { class: 'hst-ref-compare-layer' })
  // Persistent element the host renders the empty state into (and clears) in place.
  const empty = h('div', { class: 'hst-ref-compare-empty' })
  // The full-size background acts like empty canvas; columns and frames stay view content.
  const root = h('div', { 'class': 'hst-ref-compare', 'data-histoire-canvas-pan': true }, layer, empty)
  container.append(root)
  /** Issue chip per leased frame key. */
  const chips = new Map<string, HTMLElement>()
  let load: AbortController | undefined
  let storyId: string | null | undefined

  /** Follows pan and zoom like built-in arrangements. */
  const place = () => {
    const { pan, zoom } = context.canvas
    layer.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
  }
  /** Refreshes issue chips from the audit store. */
  const renderChips = () => {
    for (const [key, chip] of chips) {
      const report = model.audits.get(key)?.report
      chip.textContent = report ? issueCount(report.issues.length) : '…'
      chip.dataset.tone = report?.issues.length ? 'warn' : ''
    }
  }

  /** Leases one frame per variant of the selected story; no-op while the story is unchanged. */
  async function reload(): Promise<void> {
    const next = context.selection.target?.storyId ?? null
    if (next === storyId) return
    storyId = next
    load?.abort()
    const own = load = new AbortController()
    host.signal.addEventListener('abort', () => own.abort(), { once: true, signal: own.signal })
    layer.replaceChildren()
    chips.clear()
    columns(0)
    host.renderState(empty, next ? null : { kind: 'empty', icon: 'catalog', title: 'No story selected', detail: 'Select a story to compare its variants' })
    if (!next) return
    const story = await context.catalog.getStory(next)
    if (own.signal.aborted) return
    const variants = story.variants.slice(0, MAX_COLUMNS)
    columns(variants.length)
    // `layout` changed outside a canvas measure: Fit frames the new columns.
    context.canvas.requestLayout()
    variants.forEach((variant, index) => {
      const rect = columnRect(index)
      const chip = h('span', { class: 'hst-ref-chip' }, '…')
      const frame = h('div', { class: 'hst-ref-compare-frame' })
      Object.assign(frame.style, { width: `${FRAME.width}px`, height: `${FRAME.height}px` })
      const column = h('div', { class: 'hst-ref-compare-column' }, h('div', { class: 'hst-ref-compare-label' }, variant.title, chip), frame)
      Object.assign(column.style, { left: `${rect.x}px`, top: `${rect.y}px` })
      layer.append(column)
      // `queue` waits for a free slot instead of failing on a full budget; `signal` releases it.
      context.canvas.acquireFrame({ storyId: next, variantId: variant.id }, {
        container: frame,
        rect: { x: rect.x, y: rect.y + LABEL_HEIGHT, ...FRAME },
        queue: true,
        signal: own.signal,
      }).then((lease) => {
        chips.set(lease.frame.key, chip)
        renderChips()
        return lease.ready
      }).catch((error) => {
        if (!isReleased(error) && !own.signal.aborted) host.reportError(error)
      })
    })
  }

  const stops = [context.canvas.subscribe(place), model.audits.subscribe(renderChips)]
  let stopContext = context.subscribe(() => void reload())
  place()
  void reload()
  return {
    update(next: CanvasViewContext) {
      if (next !== context) {
        stopContext()
        stopContext = next.subscribe(() => void reload())
      }
      context = next
      place()
      void reload()
    },
    dispose() {
      load?.abort()
      host.renderState(empty, null)
      stopContext()
      stops.forEach(stop => stop())
    },
  }
}

/**
 * `canvas.view` showing the selected story's variants side by side in leased frames. DOM view
 * shared by every UI variant: geometry-heavy code stays framework-free.
 * @param model Plugin state.
 */
export function compareView(model: ReferenceModel): MountView<CanvasViewContext> & Pick<CanvasViewInput, 'layout' | 'toolbar'> {
  let count = 0
  return {
    // Fit frames the columns; read on switch, resize, frame registry changes and `requestLayout`.
    layout: () => Array.from({ length: count }, (_, index) => columnRect(index)),
    toolbar: ['search', 'tools', 'zoom', 'background', 'ui', 'plugins'],
    mount: (container, context, host) => mountCompare(container, context, host, model, (value) => {
      count = value
    }),
  }
}
