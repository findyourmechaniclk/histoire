// Annotation tool gesture state: the rectangle being drawn, in canvas space. Framework-free.
import type { CanvasPoint, CanvasToolInput, Disposer } from '@histoire/plugin-kit'
import type { Annotation, ReferencePreferences } from './preferences.js'

/** Rectangle under construction, without id. */
export type AnnotationRect = Omit<Annotation, 'id'>

/** Smallest saved annotation side, in canvas units; smaller drags are treated as clicks. */
const MIN_SIDE = 4

/**
 * Normalized rectangle between two canvas points.
 * @param from Gesture start.
 * @param to Current pointer.
 */
export function rectBetween(from: CanvasPoint, to: CanvasPoint): AnnotationRect {
  return { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) }
}

/**
 * Draft rectangle shared by the annotation tool (writes) and the annotation layer (reads).
 * @param preferences Saved annotations receive committed drafts.
 */
export function createAnnotationDraft(preferences: ReferencePreferences) {
  let start: CanvasPoint | null = null
  let draft: AnnotationRect | null = null
  const listeners = new Set<() => void>()

  /**
   * Replaces the draft and notifies observers.
   * @param next New draft or `null`.
   */
  function set(next: AnnotationRect | null): void {
    draft = next
    for (const listener of [...listeners]) listener()
  }

  /** Pointer handlers of the `canvas.tool` contribution. */
  const handlers: Pick<CanvasToolInput, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onCancel'> = {
    onPointerDown(event) {
      start = event.canvas
      set(rectBetween(start, start))
    },
    onPointerMove(event) {
      // Hover moves arrive without a gesture; only a pressed gesture draws.
      if (start) set(rectBetween(start, event.canvas))
    },
    onPointerUp(event) {
      if (!start) return
      const rect = rectBetween(start, event.canvas)
      start = null
      set(null)
      if (rect.width >= MIN_SIDE && rect.height >= MIN_SIDE) preferences.addAnnotation(rect)
    },
    onCancel() {
      start = null
      set(null)
    },
  }

  return {
    /** Current draft, `null` outside a gesture. */
    get: () => draft,
    handlers,
    /**
     * Observes draft changes.
     * @param listener Called after each change.
     */
    subscribe(listener: () => void): Disposer {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Draft state of one plugin instance. */
export type AnnotationDraft = ReturnType<typeof createAnnotationDraft>
