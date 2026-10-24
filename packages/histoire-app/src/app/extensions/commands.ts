import type { Disposer } from '@histoire/plugin-kit'
import type { createStandaloneCommands } from '../standalone/commands.js'
import type { WorkbenchHost } from './create-workbench-host.js'
import { isContributionAvailable, syncContributions } from './sync.js'

/** Command search registry the adapter feeds. */
export type CommandSearchRegistry = Pick<ReturnType<typeof createStandaloneCommands>, 'register'>

/**
 * Registers plugin `command` contributions in command search. Visibility follows the host's
 * availability rules on the root context (independent of the dev-only rule of Node-backed
 * commands); choosing a command runs it through the workbench action runner, and the returned
 * promise surfaces failures through the search pane.
 * @param workbench Workbench extension host.
 * @param commands Command search registry of the same workbench.
 */
export function registerPluginCommands(workbench: WorkbenchHost, commands: CommandSearchRegistry): Disposer {
  return syncContributions(workbench, 'command', command => commands.register({
    id: command.id,
    label: command.label,
    icon: command.icon,
    searchText: command.searchText,
    showIf: () => isContributionAvailable(workbench, 'command', command, workbench.context),
    clientAction: () => workbench.run(command.id),
  }))
}
