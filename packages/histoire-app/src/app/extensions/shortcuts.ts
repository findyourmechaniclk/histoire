import type { Disposer, QualifiedContribution } from '@histoire/plugin-kit'
import type { ShortcutRegistry } from '../util/shortcuts.js'
import type { WorkbenchHost } from './create-workbench-host.js'
import { findPluginShortcutConflict } from '@histoire/plugin-kit'
import { isContributionAvailable, syncContributions } from './sync.js'

/**
 * Committed command a shortcut targets, when registered.
 * @param workbench Workbench extension host.
 * @param id Qualified command id.
 */
function findCommand(workbench: WorkbenchHost, id: string): QualifiedContribution<'command'> | undefined {
  return workbench.host.contributions('command').find(command => command.id === id)
}

/**
 * Registers plugin `shortcut` contributions in the workbench shortcut registry, so they share
 * focus scopes, the text-input guard, hints and the Settings reference with built-ins.
 * Registration follows the rules shared with native hosts (`findPluginShortcutConflict`): a
 * binding overlapping a built-in (bound or not) or an already registered shortcut of the same
 * scope is not registered and is recorded as a diagnostic of the shortcut's plugin; its command
 * stays available elsewhere (search, toolbar).
 * The handler runs the command through the workbench action runner with the root scope.
 * @param workbench Workbench extension host.
 * @param shortcuts Shortcut registry of the same workbench.
 * @param error Receives command failures (no retry).
 */
export function registerPluginShortcuts(workbench: WorkbenchHost, shortcuts: ShortcutRegistry, error: (error: unknown) => void): Disposer {
  return syncContributions(workbench, 'shortcut', (shortcut) => {
    try {
      const conflict = findPluginShortcutConflict(shortcut, { bound: shortcuts.entries.values() })
      if (conflict) throw conflict
      return shortcuts.register({
        id: shortcut.id,
        // The Settings reference names the action, not the binding contribution.
        label: findCommand(workbench, shortcut.command)?.label ?? shortcut.command,
        keys: shortcut.keys,
        scope: shortcut.scope,
        devOnly: shortcut.devOnly,
        enabled: () => {
          const command = findCommand(workbench, shortcut.command)
          return Boolean(command)
            && isContributionAvailable(workbench, 'shortcut', shortcut, workbench.context)
            && isContributionAvailable(workbench, 'command', command!, workbench.context)
        },
        handler: () => workbench.run(shortcut.command).catch(error),
      })
    }
    catch (failure) {
      // Diagnostic attributed to the shortcut contribution (host has no app-side register phase).
      workbench.host.reportViewError(shortcut.id, failure, 'report')
    }
  })
}
