/** Pointer fields set on a synthetic event (jsdom has no `PointerEvent`). */
export interface PointerFields {
  /** Pointer identity; defaults to `1`. */
  pointerId?: number
  /** Pressed button; defaults to primary (`0`). */
  button?: number
  /** Client x; defaults to `0`. */
  clientX?: number
  /** Client y; defaults to `0`. */
  clientY?: number
}

/**
 * Bubbling, cancelable pointer-like event with a real dispatch target, so `target` and
 * `currentTarget` are native.
 * @param type Event type (`pointerdown`, `pointermove`, ...).
 * @param values Pointer fields.
 */
export function pointer(type: string, values: PointerFields = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const fields = { pointerId: 1, button: 0, clientX: 0, clientY: 0, ...values }
  Object.defineProperties(event, Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value }])))
  return event
}
