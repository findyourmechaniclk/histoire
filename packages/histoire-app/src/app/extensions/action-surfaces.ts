import type { createContextMenu } from '../composables/context-menu.js'
import type { createFrameActions, FrameActionTarget } from '../util/frame-actions.js'
import type { ShortcutRegistry } from '../util/shortcuts.js'
import type { CommandSearchRegistry } from './commands.js'
import type { WorkbenchHost } from './create-workbench-host.js'
import type { FrameSession } from './frame-context.js'
import { useHistoireResource } from '@histoire/vue/internal'
import { registerPluginCommands } from './commands.js'
import { registerPluginContextMenu, registerPluginFrameMenu } from './menus.js'
import { registerPluginShortcuts } from './shortcuts.js'

/** Existing workbench registries plugin actions are mirrored into. */
export interface PluginActionSurfaces {
  /** Command search registry. */
  commands: CommandSearchRegistry
  /** Shortcut registry. */
  shortcuts: ShortcutRegistry
  /** Frame action registry (frame context menu). */
  actions: ReturnType<typeof createFrameActions>
  /** Workbench context menu. */
  menu: ReturnType<typeof createContextMenu>
  /** Session owning a canvas frame; the canonical session when the frame has none. */
  frameSession: (target: FrameActionTarget) => FrameSession
  /** Workbench error boundary for failures with no invoking surface (shortcuts). */
  error: (error: unknown) => void
}

/**
 * Mirrors plugin commands, shortcuts, frame-menu and context-menu entries into the workbench's
 * existing registries for the lifetime of the calling workbench provider. The toolbar reads the
 * host directly (`usePluginToolbar`).
 * @param workbench Workbench extension host.
 * @param surfaces Registries of the same workbench.
 */
export function useWorkbenchPluginActions(workbench: WorkbenchHost, surfaces: PluginActionSurfaces): void {
  const stops = [
    registerPluginCommands(workbench, surfaces.commands),
    registerPluginShortcuts(workbench, surfaces.shortcuts, surfaces.error),
    registerPluginFrameMenu(workbench, surfaces.actions, surfaces.frameSession),
    registerPluginContextMenu(workbench, surfaces.menu),
  ]
  useHistoireResource(() => stops.forEach(stop => stop()))
}
