import type { CanvasService, FrameScopedContext } from '@histoire/plugin-kit'
import type { CanvasFrames } from '../../../composables/canvas-settings.js'
import type { WorkbenchHost } from '../../../extensions/create-workbench-host.js'
import type { FrameContextHandle, FrameSession } from '../../../extensions/frame-context.js'
import type { CanvasStore } from '../../../stores/canvas.js'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'

/** One rendered frame carrying frame overlays. */
export interface FrameOverlayTarget {
  /** Render key: changes when the frame's scope is replaced (new session), remounting its overlays. */
  key: string
  /** Frame-scoped context of exactly this frame. */
  context: FrameScopedContext
  /** Frame document box in viewport pixels. */
  box: { left: number, top: number, width: number, height: number }
}

/** Frame scope owned by the overlay layer. */
interface OwnedScope {
  /** Session the scope reads. */
  session: FrameSession
  /** Scope handle; retired when the frame or its session goes away. */
  handle: FrameContextHandle
  /** Monotonic generation used in render keys. */
  generation: number
}

/**
 * Track frames that rendered a document and give each its own frame-scoped context and
 * viewport box. Boxes are re-read from the frame's rendered client box on pan, zoom, layout
 * changes (rect, rotation) and window resize or scroll. Must run in a component scope.
 */
export function useFrameOverlayTargets(options: { workbench: WorkbenchHost, canvas: CanvasStore, frames: CanvasFrames, service: CanvasService }) {
  const { workbench, canvas, frames, service } = options
  const scopes = shallowRef(new Map<string, OwnedScope>())
  let generation = 0

  // Scopes follow (frame, session) pairs: a new session retires the old scope.
  watch(() => [...frames.frames.values()].map(entry => [entry.id, entry.documentId ? entry.session : undefined] as const), (list) => {
    const previous = scopes.value
    const next = new Map<string, OwnedScope>()
    for (const [id, session] of list) {
      const entry = frames.getFrame(id)
      if (!session || !entry) continue
      const kept = previous.get(id)
      next.set(id, kept?.session === session
        ? kept
        : { session, generation: ++generation, handle: workbench.frameScope({ key: id, target: { storyId: entry.storyId, variantId: entry.variantId } }, session) })
    }
    for (const [id, scope] of previous) {
      if (next.get(id) !== scope) scope.handle.retire()
    }
    scopes.value = next
  }, { immediate: true })
  onScopeDispose(() => {
    for (const scope of scopes.value.values()) scope.handle.retire()
  })

  // Client boxes move without reactive state on window resize and (nested) scroll.
  const tick = ref(0)
  const bump = (): void => void tick.value++
  window.addEventListener('resize', bump)
  window.addEventListener('scroll', bump, true)
  onScopeDispose(() => {
    window.removeEventListener('resize', bump)
    window.removeEventListener('scroll', bump, true)
  })

  const targets = computed<FrameOverlayTarget[]>(() => {
    void [tick.value, canvas.panOffset.x, canvas.panOffset.y, canvas.effectiveZoom]
    const result: FrameOverlayTarget[] = []
    for (const [id, scope] of scopes.value) {
      const entry = frames.getFrame(id)
      if (!entry?.iframe) continue
      const start = service.frameToViewport(id, { x: 0, y: 0 })
      const end = service.frameToViewport(id, { x: entry.rect.width, y: entry.rect.height })
      if (!start || !end) continue
      result.push({ key: `${id}#${scope.generation}`, context: scope.handle.context, box: { left: start.x, top: start.y, width: end.x - start.x, height: end.y - start.y } })
    }
    return result
  })
  return { targets }
}
