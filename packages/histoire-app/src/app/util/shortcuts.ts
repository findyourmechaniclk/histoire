import type { InjectionKey } from 'vue'
import { BUILTIN_SHORTCUTS, isEditableTarget, matchesShortcut, shortcutBindingsOverlap } from '@histoire/plugin-kit'
import { inject, provide, shallowReactive } from 'vue'

/** Keyboard ownership stays local to workbench/provider scope. */
export type ShortcutScope = 'global' | 'canvas' | 'frame' | 'comment'

/** One binding drives handlers, toolbar hints, menu hints and settings reference. */
export interface ShortcutDefinition {
  /** Stable action identity. */
  id: string
  /** Human-readable action name. */
  label: string
  /** Alternatives, using mod for platform command/control. */
  keys: readonly string[]
  /** Focus scope in which action can run. */
  scope: ShortcutScope
  /** Hide action in static books. */
  devOnly?: boolean
  /** Permit shortcut while editing text. */
  allowInput?: boolean
  /** Optional live capability gate. */
  enabled?: () => boolean
  /** Execute action after preventing native default. */
  handler: (event: KeyboardEvent) => unknown
}

/** Handler-free reference remains available while a route's tools are unmounted. */
export type ShortcutReference = Pick<ShortcutDefinition, 'id' | 'label' | 'keys' | 'scope' | 'devOnly'>

/** Built-in bindings live in plugin-kit so native hosts apply the same precedence. */
const builtins: readonly ShortcutReference[] = BUILTIN_SHORTCUTS

/** Exact modifiers avoid stale held-key state and accidental shifted actions. */
export { matchesShortcut }

/** Detect editable native controls without requiring a global DOM realm. */
export const isEditing = isEditableTarget

/** Per-workbench registration; disposer removes only its original definition and its non-built-in reference. */
export function createShortcutRegistry() {
  const entries = shallowReactive(new Map<string, ShortcutDefinition>())
  const builtinById = new Map(builtins.map(item => [item.id, item]))
  const reference = shallowReactive(new Map(builtinById))
  const registry = {
    entries,
    reference,
    /** Reject ambiguous bindings before attaching listeners. */
    register(definition: ShortcutDefinition): () => void {
      if (entries.has(definition.id)) throw new Error(`Duplicate shortcut id: ${definition.id}`)
      for (const existing of entries.values()) {
        if (shortcutBindingsOverlap(existing, definition)) throw new Error(`Duplicate shortcut binding: ${definition.id}`)
      }
      entries.set(definition.id, definition)
      const { id, label, keys, scope, devOnly } = definition
      reference.set(id, { id, label, keys, scope, devOnly })
      return () => {
        // Only the live registration owns its id; stale disposers must not touch a replacement.
        if (entries.get(id) !== definition) return
        entries.delete(id)
        // Built-ins stay listed (with canonical metadata) while their surface is unmounted;
        // other shortcuts (e.g. plugin ones) leave the Settings reference with their handler.
        const builtin = builtinById.get(id)
        if (builtin) reference.set(id, builtin)
        else reference.delete(id)
      }
    },
    /** Bind canonical metadata while preserving removable per-surface runtime authority. */
    bind(id: string, handler: ShortcutDefinition['handler'], options: Pick<ShortcutDefinition, 'enabled' | 'allowInput'> = {}): () => void {
      const descriptor = reference.get(id)
      if (!descriptor) throw new Error(`Unknown shortcut: ${id}`)
      return registry.register({ ...descriptor, ...options, handler })
    },
    /** Ordered scopes give focused frame/canvas actions precedence over global ones. */
    handle(event: KeyboardEvent, scopes: readonly ShortcutScope[], dev: boolean): boolean {
      if (event.defaultPrevented || event.repeat) return false
      for (const scope of scopes) {
        const action = [...entries.values()].find(item => item.scope === scope && (!item.devOnly || dev) && (!isEditing(event.target) || item.allowInput) && item.enabled?.() !== false && item.keys.some(binding => matchesShortcut(binding, event)))
        if (!action) continue
        event.preventDefault()
        action.handler(event)
        return true
      }
      return false
    },
    /** Human-readable first alternative shared by every shortcut hint. */
    hint(id: string): string {
      const command = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) ? '⌘' : 'Ctrl'
      // Single keys read as caps (M, 1); named keys as words (Enter, Tab, Esc).
      const label = (key: string) => ({ mod: command, shift: '⇧', alt: 'Alt', space: 'Space', escape: 'Esc' } as Record<string, string>)[key] ?? (key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1))
      return (entries.get(id) ?? reference.get(id))?.keys[0]?.split('+').map(label).join(' ') ?? ''
    },
  }
  return registry
}

/** Per-workbench shortcut registry. */
export type ShortcutRegistry = ReturnType<typeof createShortcutRegistry>

/** Injectable registry prevents unrelated workbenches sharing keyboard authority. */
const shortcutsKey: InjectionKey<ReturnType<typeof createShortcutRegistry>> = Symbol('histoire-shortcuts')

/** Bind registry created by standalone shell. */
export function provideShortcutRegistry(registry: ReturnType<typeof createShortcutRegistry>): void {
  provide(shortcutsKey, registry)
}

/** Independent surfaces may omit keyboard bindings. */
export function useShortcutRegistry(): ReturnType<typeof createShortcutRegistry> | undefined {
  return inject(shortcutsKey, undefined)
}
