import type { HistoireTarget } from '@histoire/protocol'
import type { ActionRun } from './actions.js'
import type { ContributionBase } from './base.js'
import type { WorkbenchIcon } from './common.js'
import type { FrameRef, FrameScopedContext, WorkbenchContext } from './context.js'

/** Nested frame menu entry. */
export interface FrameMenuChild {
  /** Local id, unique among siblings, without whitespace or `:`; runnable as `${itemId}:${id}`. */
  id: string
  /** Visible label. */
  label: string
  /** Entry icon. */
  icon: WorkbenchIcon
  /** Adjacent groups receive a separator. */
  group?: string
  /** Action run on the right-clicked frame. */
  run: ActionRun<FrameScopedContext>
}

/** Entry in the frame context menu; runs against the right-clicked frame. */
export type FrameMenuItemInput = ContributionBase<FrameScopedContext> & {
  /** Visible label. */
  label: string
  /** Entry icon. */
  icon: WorkbenchIcon
  /** Adjacent groups receive a separator. */
  group?: string
  /** Optional submenu entries. */
  children?: readonly FrameMenuChild[]
  /** Action run on the right-clicked frame. */
  run: ActionRun<FrameScopedContext>
}

/** Existing workbench context-menu target kinds. */
export type ContextMenuTargetKind =
  | 'frame'
  | 'story'
  | 'search-result'
  | 'test'
  | 'inspector'
  | 'toolbar'
  | 'folder'
  | 'test-group'
  | 'comment'
  | 'control'

/** Serializable description of the right-clicked target. */
export interface ContextMenuTarget {
  /** Target kind. */
  readonly kind: ContextMenuTargetKind
  /** Target label as shown in the workbench. */
  readonly label: string
  /** Stable target key when the target has one. */
  readonly key?: string
  /** Story/variant identity when the target carries one. */
  readonly selection?: HistoireTarget
  /** Frame identity for frame-bound targets. */
  readonly frame?: FrameRef
}

/** Context passed to context-menu entries. */
export interface ContextMenuContext extends WorkbenchContext {
  /** Right-clicked target, captured when the menu opened. */
  readonly target: ContextMenuTarget
}

/** Entry in the existing workbench context menu. */
export type ContextMenuItemInput = ContributionBase<ContextMenuContext> & {
  /** Target kinds showing the entry. */
  targets: readonly ContextMenuTargetKind[]
  /** Visible label. */
  label: string
  /** Optional entry icon. */
  icon?: WorkbenchIcon
  /** Action run on the captured target. */
  run: ActionRun<ContextMenuContext>
}

/** Registered frame menu entry. */
export type FrameMenuItemContribution = FrameMenuItemInput & { kind: 'frame-menu.item' }

/** Registered context menu entry. */
export type ContextMenuItemContribution = ContextMenuItemInput & { kind: 'context-menu.item' }
