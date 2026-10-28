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
 * Tab values that do not fit the row and move to the overflow menu. The active tab takes
 * priority; the other tabs fill remaining space in their original order.
 * @param values Tab values in display order.
 * @param metrics Row geometry; nothing overflows before the first measurement.
 * @param active Active tab value.
 */
export function getOverflowedTabs(values: readonly string[], metrics: TabRowMetrics | null, active: string | undefined): ReadonlySet<string> {
  if (!metrics) return new Set()
  const keepsActive = active !== undefined && values.includes(active)
  const order = [...(keepsActive ? [active] : []), ...values.filter(value => value !== active)]
  const fitted = fitOverflowItems(order.map(value => ({ width: metrics.widths.get(value) ?? 0 })), metrics.available, metrics.trigger, metrics.gap)
  return new Set(order.slice(Math.max(fitted, keepsActive ? 1 : 0)))
}

/**
 * Whether an active tab with an icon needs its label visually hidden to leave room for the menu.
 * @param metrics Row geometry; never compact before the first measurement.
 * @param active Active tab value.
 * @param hasIcon Whether the active tab has an icon to represent it.
 * @param hasOverflow Whether the menu trigger is needed.
 */
export function isActiveTabCompact(metrics: TabRowMetrics | null, active: string | undefined, hasIcon: boolean, hasOverflow: boolean): boolean {
  return Boolean(metrics && active !== undefined && hasIcon && hasOverflow && (metrics.widths.get(active) ?? 0) + metrics.trigger + metrics.gap > metrics.available)
}

/**
 * Measures the tab row and derives which tabs overflow. Every tab stays rendered (overflowed
 * ones hidden), so all natural widths are measurable; measurements reuse the overflow toolbar's
 * clone measurement and width cache. Re-measures on mount, tab changes, row resizes and font loads.
 * @param list Tab list element; its direct `[role="tab"]` children follow `values()` order.
 * @param trigger Overflow trigger element.
 * @param values Tab values in display order.
 * @param active Active tab value.
 * @param activeHasIcon Whether the active tab has an icon.
 */
export function useTabOverflow(list: ShallowRef<HTMLElement | null>, trigger: () => HTMLElement | null, values: () => readonly string[], active: () => string | undefined, activeHasIcon: () => boolean) {
  const metrics = shallowRef<TabRowMetrics | null>(null)
  const cache = createItemWidthCache()
  let resize: ResizeObserver | undefined
  let mutations: MutationObserver | undefined
  let fonts: FontFaceSet | undefined

  /** Reads all widths in one detached measurement host, then publishes them at once. */
  function measure(): void {
    const element = list.value
    if (!element) return
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
    if (typeof MutationObserver !== 'undefined' && list.value) {
      mutations = new MutationObserver((records) => {
        // Measurement clones are detached before delivery. Only changes inside live tabs
        // matter; presentation attributes on the tab itself must not trigger another measure.
        if (records.some((record) => {
          const target = record.target instanceof Element ? record.target : record.target.parentElement
          const tab = target?.closest('[role="tab"]')
          return tab?.parentElement === list.value && (record.type !== 'attributes' || target !== tab)
        })) {
          measure()
        }
      })
      mutations.observe(list.value, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] })
    }
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
    mutations?.disconnect()
    fonts?.removeEventListener('loadingdone', remeasureAll)
  })

  const overflowed = computed(() => getOverflowedTabs(values(), metrics.value, active()))
  const compact = computed(() => isActiveTabCompact(metrics.value, active(), activeHasIcon(), overflowed.value.size > 0))
  return { overflowed, compact }
}
