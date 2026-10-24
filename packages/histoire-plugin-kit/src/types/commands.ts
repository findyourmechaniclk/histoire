import type { ActionRun } from './actions.js'
import type { ContributionBase } from './base.js'
import type { WorkbenchIcon } from './common.js'
import type { WorkbenchContext } from './context.js'

/** Keyboard focus scope; mirrors the workbench shortcut registry scopes. */
export type ShortcutScope = 'global' | 'canvas' | 'frame' | 'comment'

/** Entry in command search. */
export type CommandInput = ContributionBase<WorkbenchContext> & {
  /** Visible command name. */
  label: string
  /** Command icon. */
  icon: WorkbenchIcon
  /** Extra text matched by search. */
  searchText?: string
  /** Action run when the command is chosen. */
  run: ActionRun<WorkbenchContext>
}

/** Keyboard binding for a command, registered in the existing shortcut registry. */
export type ShortcutInput = ContributionBase<WorkbenchContext> & {
  /** Qualified command id (`acme:run`). */
  command: string
  /** Alternative key combinations; `mod` maps to command/control. */
  keys: readonly string[]
  /** Focus scope in which the shortcut runs. */
  scope: ShortcutScope
}

/** Registered command. */
export type CommandContribution = CommandInput & { kind: 'command' }

/** Registered shortcut. */
export type ShortcutContribution = ShortcutInput & { kind: 'shortcut' }
