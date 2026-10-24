import type { PluginShortcutBindings, ShortcutScope } from '@histoire/plugin-kit'
import type { HistoireProviderExtensions } from './extensions.js'
import { createPluginShortcutBindings, isEditableTarget } from '@histoire/plugin-kit'
import { watch } from 'vue'

/** Attribute naming the native focus area (`canvas`, `frame`) an element belongs to. */
export const HISTOIRE_SHORTCUT_SCOPE_ATTRIBUTE = 'data-histoire-shortcut-scope'

/**
 * Shortcut scopes native hosts route keys to: `canvas` is the explorer canvas
 * (`ExplorerPreview`), `frame` its single-variant frame. `comment` has no native surface:
 * shortcuts in it are disabled with a diagnostic at registration.
 */
export const NATIVE_SHORTCUT_SCOPES: readonly ShortcutScope[] = Object.freeze(['global', 'canvas', 'frame'])

/**
 * Scopes containing `target`, innermost first (frame, canvas, then global), like the standalone
 * workbench. Focus areas outside `root` (a host page wrapping the provider) do not count.
 * @param target Key event target.
 * @param root Provider root.
 */
function eventScopes(target: Element, root: HTMLElement): ShortcutScope[] {
  const scopes: ShortcutScope[] = []
  for (const scope of ['frame', 'canvas'] as const) {
    const area = target.closest(`[${HISTOIRE_SHORTCUT_SCOPE_ATTRIBUTE}="${scope}"]`)
    if (area && root.contains(area)) scopes.push(scope)
  }
  scopes.push('global')
  return scopes
}

/**
 * Binds plugin `shortcut` contributions to one provider root. Bindings are checked when they are
 * committed (shared plugin-kit rules: built-ins win, earlier bindings win, scopes without a native
 * surface are rejected), each rejection recorded once as a diagnostic; commands stay available.
 * Events from nested providers, text inputs or already handled keys are ignored.
 * @param root Provider root element.
 * @param extensions Provider plugin state; only a provider owning its host binds keys.
 * @param reportError Receives command failures.
 * @returns Removes the listener and stops observing the host.
 */
export function bindPluginShortcuts(root: HTMLElement, extensions: HistoireProviderExtensions, reportError: (error: unknown) => void): () => void {
  let bindings: PluginShortcutBindings | undefined
  // The host can change with the `extensions` prop; registrations are tracked per host.
  const stopHost = watch(() => extensions.owned ? extensions.host : undefined, (host, _previous, onCleanup) => {
    if (!host) return
    bindings = createPluginShortcutBindings(host, NATIVE_SHORTCUT_SCOPES)
    const current = bindings
    onCleanup(() => {
      current.dispose()
      if (bindings === current) bindings = undefined
    })
  }, { immediate: true, flush: 'sync' })

  /** Runs the command of the first matching available shortcut, innermost scope first. */
  function keydown(event: KeyboardEvent): void {
    const context = extensions.context
    const target = event.target as Element | null
    if (!bindings || !context || !target?.closest || event.defaultPrevented || event.repeat || isEditableTarget(target)) return
    if (target.closest('.histoire-provider') !== root) return
    const shortcuts = extensions.available('shortcut', context)
    const commands = extensions.available('command', context)
    const shortcut = bindings.match(event, eventScopes(target, root), candidate => shortcuts.includes(candidate) && commands.some(command => command.id === candidate.command))
    if (!shortcut) return
    event.preventDefault()
    event.stopPropagation()
    void extensions.run(shortcut.command, context).catch(reportError)
  }

  root.addEventListener('keydown', keydown)
  return () => {
    root.removeEventListener('keydown', keydown)
    stopHost()
  }
}
