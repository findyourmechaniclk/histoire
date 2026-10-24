import type { CanvasScopedContext, CanvasService, CanvasToolPointerEvent, CanvasToolPointerHandler, QualifiedContribution } from '@histoire/plugin-kit'
import type { CanvasFrames, CanvasPointerPan } from '../../../composables/canvas-settings.js'

/** Registered plugin canvas tool. */
export type PluginCanvasTool = QualifiedContribution<'canvas.tool'>

/** Inputs of one plugin tool's pointer gestures. */
export interface PluginToolGestureOptions {
  /** Viewport pan owner; it sees every press first (Space, middle button). */
  pointerPan?: CanvasPointerPan
  /** Active plugin tool, if any. */
  tool: () => PluginCanvasTool | undefined
  /** Canvas-scoped context handed to tool handlers. */
  context: () => CanvasScopedContext | undefined
  /** Converts a DOM pointer event into the tool's coordinates. */
  describe: (event: PointerEvent) => CanvasToolPointerEvent
  /** A handler threw; the gesture already ended. */
  fail: (tool: PluginCanvasTool, error: unknown) => void
}

/** Primary-button gesture owned by a plugin tool. */
interface ToolGesture {
  /** Captured pointer. */
  pointerId: number
  /** Element holding pointer capture. */
  target: Element | null
  /** Tool captured at gesture start; its handlers finish the gesture even after a switch. */
  tool: PluginCanvasTool
}

/**
 * Pointer handling of the active plugin tool, using the overlay relay pattern of
 * MeasureOverlay: every press is offered to the viewport pan owner first; only declined
 * primary presses start a tool gesture. Moves are suspended while a pan owns the pointer.
 */
export function createPluginToolGesture(options: PluginToolGestureOptions) {
  let panPointerId: number | undefined
  let gesture: ToolGesture | undefined

  /** End the current gesture and release its pointer capture; returns the ended gesture. */
  function end(): ToolGesture | undefined {
    const current = gesture
    gesture = undefined
    if (current?.target?.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId)
    return current
  }

  /** Run one handler; a throwing handler ends the gesture and is reported. */
  function invoke(tool: PluginCanvasTool, handler: CanvasToolPointerHandler | undefined, event: PointerEvent): void {
    const context = options.context()
    if (!handler || !context) return
    try {
      handler(options.describe(event), context)
    }
    catch (error) {
      end()
      options.fail(tool, error)
    }
  }

  /** Offer the press to panning, then start a tool gesture on a declined primary press. */
  function pointerDown(event: PointerEvent): void {
    if (gesture) return
    if (options.pointerPan?.onPointerDown(event)) {
      panPointerId = event.pointerId
      return
    }
    const tool = options.tool()
    if (event.button !== 0 || !tool) return
    event.preventDefault()
    const target = event.currentTarget as Element | null
    try {
      target?.setPointerCapture?.(event.pointerId)
    }
    catch {}
    gesture = { pointerId: event.pointerId, target, tool }
    invoke(tool, tool.onPointerDown, event)
  }

  /** Relay pan moves; otherwise deliver gesture or hover moves while no pan is active. */
  function pointerMove(event: PointerEvent): void {
    if (panPointerId === event.pointerId) {
      options.pointerPan?.onPointerMove(event)
      return
    }
    if (options.pointerPan?.isPanning.value) return
    if (gesture && gesture.pointerId !== event.pointerId) return
    const tool = gesture?.tool ?? options.tool()
    if (tool) invoke(tool, tool.onPointerMove, event)
  }

  /** Finish the pan or the tool gesture owning this pointer. */
  function pointerUp(event: PointerEvent): void {
    if (panPointerId === event.pointerId) {
      options.pointerPan?.onPointerUp(event)
      panPointerId = undefined
      return
    }
    if (gesture?.pointerId !== event.pointerId) return
    const ended = end()!
    invoke(ended.tool, ended.tool.onPointerUp, event)
  }

  /** Browser cancellation cancels the gesture owning this pointer. */
  function pointerCancel(event: PointerEvent): void {
    if (panPointerId === event.pointerId) {
      options.pointerPan?.onPointerCancel(event)
      panPointerId = undefined
      return
    }
    if (gesture?.pointerId === event.pointerId) cancel()
  }

  /** Cancel the active gesture (Escape, pan takeover, tool switch or removal); idempotent. */
  function cancel(): void {
    const ended = end()
    const context = options.context()
    if (!ended?.tool.onCancel || !context) return
    try {
      ended.tool.onCancel(context)
    }
    catch (error) {
      options.fail(ended.tool, error)
    }
  }

  /** Retire all input before the capture surface goes away. */
  function retire(): void {
    cancel()
    if (panPointerId !== undefined) options.pointerPan?.release()
    panPointerId = undefined
  }

  return { pointerDown, pointerMove, pointerUp, pointerCancel, cancel, retire, active: () => !!gesture }
}

/**
 * Describe a pointer for tool handlers: viewport-local and canvas coordinates, and the
 * registered frame whose document lies under the pointer.
 * @param event DOM pointer event.
 * @param canvas Canvas service of the viewport.
 * @param frames Viewport frame registry.
 */
export function describeToolPointer(event: PointerEvent, canvas: CanvasService, frames: CanvasFrames): CanvasToolPointerEvent {
  const origin = canvas.viewport
  const viewport = { x: event.clientX - origin.x, y: event.clientY - origin.y }
  const client = { x: event.clientX, y: event.clientY }
  const entry = [...frames.frames.values()].find((frame) => {
    const point = frames.clientToFrame(frame.id, client)
    return point && point.x >= 0 && point.y >= 0 && point.x <= frame.rect.width && point.y <= frame.rect.height
  })
  return Object.freeze({
    event,
    viewport,
    canvas: canvas.toCanvas(viewport),
    frame: entry ? Object.freeze({ key: entry.id, target: Object.freeze({ storyId: entry.storyId, variantId: entry.variantId }) }) : null,
  })
}
