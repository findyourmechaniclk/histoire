import type { WorkbenchPluginApi } from '../../../../histoire-plugin-kit/src/index.js'
import { describe, expect, it, vi } from 'vitest'
import { registerPluginShortcuts } from '../../../../histoire-app/src/app/extensions/shortcuts.js'
import { createShortcutRegistry } from '../../../../histoire-app/src/app/util/shortcuts.js'
import { flushMicrotasks } from './utils/flush.js'
import { keyboard } from './utils/keyboard-event.js'
import { createTestWorkbenchHost, pluginEntry } from './utils/workbench-extensions.js'

/**
 * Workbench whose plugin registers commands and shortcuts, with the shortcut adapter attached
 * to a fresh registry.
 * @param setup Plugin setup.
 */
async function setupShortcuts(setup: (api: WorkbenchPluginApi) => void) {
  const { workbench } = createTestWorkbenchHost({ plugins: [pluginEntry({ id: 'acme', apiVersion: 1, setup })] })
  await workbench.host.ready
  const shortcuts = createShortcutRegistry()
  const error = vi.fn()
  const stop = registerPluginShortcuts(workbench, shortcuts, error)
  return { workbench, shortcuts, error, stop }
}

/** Event target inside an editable control. */
const editing = { closest: () => ({}) } as unknown as EventTarget

describe('plugin shortcuts', () => {
  it('run their command once in the focused scope and never while editing text', async () => {
    const run = vi.fn()
    const { shortcuts, workbench } = await setupShortcuts((api) => {
      api.commands.add({ id: 'sync', label: 'Sync', icon: 'renew', run })
      api.shortcuts.add({ id: 'sync-key', command: 'acme:sync', keys: ['shift+y'], scope: 'frame' })
    })

    expect(shortcuts.handle(keyboard('Y', { shiftKey: true }), ['canvas', 'global'], true)).toBe(false)
    expect(shortcuts.handle(keyboard('Y', { shiftKey: true, target: editing }), ['frame', 'canvas', 'global'], true)).toBe(false)
    expect(shortcuts.handle(keyboard('Y', { shiftKey: true }), ['frame', 'canvas', 'global'], true)).toBe(true)
    await flushMicrotasks()

    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0][0].source.mode).toBe('dev')
    await workbench.dispose()
  })

  it('disables a binding taken by a built-in with a diagnostic while its command stays available', async () => {
    const { shortcuts, workbench } = await setupShortcuts((api) => {
      api.commands.add({ id: 'fit', label: 'Fit plugin', icon: 'fit-to-screen', run: () => {} })
      // `shift+1` belongs to the built-in `canvas.fit`, even while the canvas is unmounted.
      api.shortcuts.add({ id: 'fit-key', command: 'acme:fit', keys: ['shift+1'], scope: 'canvas' })
    })

    expect(shortcuts.reference.has('acme:fit-key')).toBe(false)
    expect(workbench.host.diagnostics()).toEqual([expect.objectContaining({ pluginId: 'acme', contributionId: 'acme:fit-key' })])
    expect(workbench.host.available('command', workbench.context).map(command => command.id)).toEqual(['acme:fit'])
    expect(() => shortcuts.bind('canvas.fit', vi.fn())).not.toThrow()
    await workbench.dispose()
  })

  it('leave the settings reference when their plugin tears down', async () => {
    const { shortcuts, workbench } = await setupShortcuts((api) => {
      api.commands.add({ id: 'sync', label: 'Sync', icon: 'renew', run: () => {} })
      api.shortcuts.add({ id: 'sync-key', command: 'acme:sync', keys: ['shift+y'], scope: 'global' })
    })
    expect(shortcuts.reference.get('acme:sync-key')).toMatchObject({ label: 'Sync', keys: ['shift+y'], scope: 'global' })

    await workbench.dispose()

    expect(shortcuts.reference.has('acme:sync-key')).toBe(false)
    expect(shortcuts.entries.has('acme:sync-key')).toBe(false)
    expect(shortcuts.reference.has('canvas.fit')).toBe(true)
  })
})
