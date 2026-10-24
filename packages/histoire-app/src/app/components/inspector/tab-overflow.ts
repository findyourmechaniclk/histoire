import type { ShallowRef } from 'vue'
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { fitOverflowItems } from '../base/overflow/fit.js'
import { createItemWidthCache, measureInlineItem, toolbarAvailableWidth } from '../base/overflow/measurement.js'

/** Measured geometry of the inspector tab row. */
export interface TabRowMetrics {
  /** Natural width per tab value. */
  widths: ReadonlyMap<string, number>
  /** Width shared by the tabs and the overflow trigger. */
  available: number
  /** Natural width of the overflow trigger. */
  trigger: number
  /** Gap between tabs. */
  gap: number
}

/**
 * Tab values that do not fit the row and move to the overflow menu. The first `pinned` tabs
 * (built-ins) and the active tab always stay in the row; the other tabs keep their order and
 * fill the remaining room with the shared overflow fit (`fitOverflowItems`).
 * @param values Tab values in display order.
 * @param metrics Row geometry; nothing overflows before the first measurement.
 * @param pinned Number of leading tabs that never overflow.
 * @param active Active tab value.
 */
export function getOverflowedTabs(values: readonly string[], metrics: TabRowMetrics | null, pinned: number, active: string | undefined): ReadonlySet<string> {
  if (!metrics) return new Set()
  const rest = values.slice(pinned)
  const keepsActive = active !== undefined && rest.includes(active)
  // Fit order: pinned tabs, then the active tab, then the others in display order.
  const order = [...values.slice(0, pinned), ...(keepsActive ? [active] : []), ...rest.filter(value => value !== active)]
  const fitted = fitOverflowItems(order.map(value => ({ width: metrics.widths.get(value) ?? 0 })), metrics.available, metrics.trigger, metrics.gap)
  return new Set(order.slice(Math.max(fitted, pinned + (keepsActive ? 1 : 0))))
}

/**
 * Whether the active tab is a non-pinned (plugin) tab that does not fit the row next to the
 * pinned tabs at its natural width. It still stays in the row; the inspector shows it compact
 * (icon and badge, label kept for assistive technology) so built-in labels keep their room.
 * @param values Tab values in display order.
 * @param metrics Row geometry; never compact before the first measurement.
 * @param pinned Number of leading tabs that never overflow.
 * @param active Active tab value.
 */
export function isActiveTabCompact(values: readonly string[], metrics: TabRowMetrics | null, pinned: number, active: string | undefined): boolean {
  if (!metrics || active === undefined || !values.slice(pinned).includes(active)) return false
  const kept = [...values.slice(0, pinned), active].map(value => ({ width: metrics.widths.get(value) ?? 0 }))
  return fitOverflowItems(kept, metrics.available, metrics.trigger, metrics.gap) < kept.length
}

/**
 * Measures the tab row and derives which tabs overflow. Every tab stays rendered (overflowed
 * ones hidden), so all natural widths are measurable; measurements reuse the overflow toolbar's
 * clone measurement and width cache. Re-measures on mount, tab changes, row resizes and font loads.
 * @param list Tab list element; its direct `[role="tab"]` children follow `values()` order.
 * @param trigger Overflow trigger element.
 * @param values Tab values in display order.
 * @param pinned Number of leading tabs that never overflow.
 * @param active Active tab value.
 */
export function useTabOverflow(list: ShallowRef<HTMLElement | null>, trigger: () => HTMLElement | null, values: () => readonly string[], pinned: () => number, active: () => string | undefined) {
  const metrics = shallowRef<TabRowMetrics | null>(null)
  const cache = createItemWidthCache()
  let resize: ResizeObserver | undefined
  let fonts: FontFaceSet | undefined

  /** Reads all widths in one detached measurement host, then publishes them at once. */
  function measure(): void {
    const element = list.value
    if (!element) return
    // Only non-pinned (plugin) tabs overflow or compact: a row of built-ins needs no geometry,
    // and skipping it avoids a forced layout while the inspector mounts.
    if (values().length <= pinned()) {
      metrics.value = null
      return
    }
    const host = element.ownerDocument.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.inert = true
    // Block host: clones take their natural width, free of the row's flex distribution.
    host.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:max-content;top:0;inset-inline-start:0'
    element.append(host)
    try {
      const order = values()
      const widths = new Map<string, number>()
      element.querySelectorAll<HTMLElement>(':scope > [role="tab"]').forEach((tab, index) => {
        if (index < order.length) widths.set(order[index], cache.measure(tab, host))
      })
      const button = trigger()
      const gap = Number.parseFloat(element.ownerDocument.defaultView?.getComputedStyle(element).columnGap ?? '') || 3
      metrics.value = { widths, available: toolbarAvailableWidth(element), trigger: (button && measureInlineItem(button, host)) || 28, gap }
    }
    finally { host.remove() }
  }

  /** Styling can change without markup changes (resize, fonts): drop cached widths. */
  function remeasureAll(): void {
    cache.clear()
    measure()
  }

  watch(values, measure, { flush: 'post' })
  onMounted(() => {
    fonts = list.value?.ownerDocument.fonts
    fonts?.addEventListener('loadingdone', remeasureAll)
    if (typeof ResizeObserver !== 'undefined' && list.value?.parentElement) {
      // The initial observation measures once layout is computed, before paint. Measuring here
      // too would force a synchronous layout of the whole freshly mounted inspector.
      resize = new ResizeObserver(remeasureAll)
      resize.observe(list.value.parentElement)
    }
    else {
      measure()
    }
  })
  onBeforeUnmount(() => {
    resize?.disconnect()
    fonts?.removeEventListener('loadingdone', remeasureAll)
  })

  const overflowed = computed(() => getOverflowedTabs(values(), metrics.value, pinned(), active()))
  const compact = computed(() => isActiveTabCompact(values(), metrics.value, pinned(), active()))
  return { overflowed, compact }
}
