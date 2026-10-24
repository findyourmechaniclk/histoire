import { vi } from 'vitest'

/**
 * Minimal native keyboard event projection keeping shortcut registry tests independent of DOM.
 * @param key `KeyboardEvent.key` value; `code` is derived (`Space`, `KeyX`).
 * @param modifiers Fields overriding the defaults (modifiers, `target`, `code`).
 */
export function keyboard(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return { key, code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, defaultPrevented: false, repeat: false, target: null, preventDefault: vi.fn(), ...modifiers } as unknown as KeyboardEvent
}
