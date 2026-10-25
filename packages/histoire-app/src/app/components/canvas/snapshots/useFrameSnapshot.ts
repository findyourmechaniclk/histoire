import type { HistoireSession } from '@histoire/sdk'
import type { Ref } from 'vue'
import type { CanvasStore } from '../../../stores/canvas.js'
import type { CanvasSize } from '../pan/usePanZoom.js'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { isColorSchemeDark } from '../../../../embed/color-scheme.js'
import { whenCanvasStartupIdle } from '../canvas-startup-activity.js'
import { captureFrameSnapshot } from './capture.js'
import { renderFrameSnapshot } from './document.js'
import { createFrameSnapshotStore } from './store.js'

/** Delay after a cell is ready (and the canvas idle): lets data-driven content settle. */
const CAPTURE_DELAY_MS = 1000

let store: ReturnType<typeof createFrameSnapshotStore> | undefined
/** One store per workbench document; absent where IndexedDB isn't. */
function getStore() {
  if (typeof indexedDB === 'undefined') return undefined
  return store ??= createFrameSnapshotStore()
}

/**
 * Shows a cell's last rendering while its live frame loads, and records a new
 * one once the frame is ready. Matrix cells (props overrides) are left out.
 */
export function useFrameSnapshot(options: {
  /** Nearest workbench: content sizes and auto-fit mode. */
  canvas: CanvasStore
  /** Current snapshot supplied by provider. */
  snapshot: Ref<ReturnType<HistoireSession['getSnapshot']>>
  /** Current exact rendered cell/variant target. */
  target: () => { frameId: string, storyId: string, variantId: string, propsOverride?: Record<string, unknown>, viewport?: unknown }
  /** Configured standalone source base, resolving the snapshot's relative URLs. */
  previewBase: () => string
  /** Replica container holding the same-origin sandbox iframe. */
  container: Ref<HTMLElement | undefined>
  /** Runtime restoration completed for current actor. */
  ready: Ref<boolean>
  /** Content size cache key of the cell, and its measured size. */
  content: { key: Ref<string>, size: Ref<CanvasSize | undefined> }
}) {
  /** `srcdoc` of the stored snapshot, until the live frame is ready. */
  const document = shallowRef<string>()
  const key = computed(() => {
    const value = options.snapshot.value
    const target = options.target()
    if (target.propsOverride || !value.source || typeof window === 'undefined') return ''
    return JSON.stringify([value.source.sourceId, target.storyId, target.variantId, isColorSchemeDark(value.settings.colorScheme, window)])
  })
  let cancelCapture = () => {}

  watch(key, async (current) => {
    document.value = undefined
    if (!current || options.ready.value) return
    const stored = await getStore()?.get(current).catch(() => undefined)
    if (!stored || key.value !== current || options.ready.value) return
    document.value = renderFrameSnapshot(stored, stored.css, new URL('__sandbox.html', options.previewBase()).href)
    // The stored size gives the cell its final height before the frame measures it.
    const target = options.target()
    const width = options.snapshot.value.settings.responsiveWidth
    if (stored.size && stored.width === width && !target.viewport && options.canvas.autoFitContent && !options.content.size.value && options.content.key.value) {
      options.canvas.contentSizes.set(target.frameId, options.content.key.value, stored.size)
    }
  }, { immediate: true })

  /** Records the cell as currently rendered. */
  function capture(current: string): void {
    const frameDocument = options.container.value?.querySelector('iframe')?.contentDocument
    if (!options.ready.value || key.value !== current || !frameDocument?.body) return
    try {
      const size = options.content.size.value
      void getStore()?.put(current, captureFrameSnapshot(frameDocument), size ? { size, width: options.snapshot.value.settings.responsiveWidth } : {}).catch(() => {})
    }
    catch {
      // Unreadable document (cross-origin embed): no snapshot.
    }
  }

  watch(options.ready, (ready) => {
    cancelCapture()
    if (!ready) return
    document.value = undefined
    const current = key.value
    if (!current) return
    // Capturing serializes the cell: wait until frames stopped loading.
    let timer: ReturnType<typeof setTimeout> | undefined
    const cancelIdle = whenCanvasStartupIdle(() => {
      timer = setTimeout(() => capture(current), CAPTURE_DELAY_MS)
    })
    cancelCapture = () => {
      cancelIdle()
      clearTimeout(timer)
    }
  }, { immediate: true })
  onBeforeUnmount(() => cancelCapture())

  return { document }
}
