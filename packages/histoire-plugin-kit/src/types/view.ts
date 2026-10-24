import type { Awaitable } from './common.js'

/**
 * Vue component compiled against the workbench Vue instance.
 * Kept opaque in the root entry so importing contracts never pulls `vue` types.
 */
export type WorkbenchComponent = object

/** View rendered as a workbench Vue component receiving a `context` prop. */
export interface ComponentView {
  /** Component rendered with the surface context as its `context` prop. */
  component: WorkbenchComponent
  /** Exclusive with `component`. */
  mount?: never
}

/** View rendered through the framework-neutral DOM mount contract. */
export interface MountView<C> {
  /** Mounts into a host-owned container. */
  mount: ViewMount<C>
  /** Exclusive with `mount`. */
  component?: never
}

/** Either renderer; both are first-class for every view-bearing contribution. */
export type ContributionView<C> = ComponentView | MountView<C>

/**
 * Mounts a view into `container`. The host owns the container; the view owns its children.
 * Returning a handle lets the host push context snapshots and dispose the view.
 */
export type ViewMount<C> = (
  container: HTMLElement,
  context: C,
  host: ViewHost,
) => Awaitable<ViewHandle<C> | void>

/** Host services available to one mounted view. */
export interface ViewHost {
  /** Aborted when the view's scope retires; late mount completions are disposed immediately. */
  signal: AbortSignal
  /** Element for popovers and menus that inherits workbench theme variables. */
  overlayRoot: HTMLElement
  /** Reports an error attributed to this view's plugin and contribution. */
  reportError: (error: unknown) => void
  /**
   * Renders a workbench empty, loading or error state into `container` (an element the view
   * owns), replacing its children; `null` clears it. Calling again re-renders in place. Hosts
   * render their own state components; without one, plain accessible markup.
   */
  renderState: (container: HTMLElement, state: WorkbenchState | null) => void
}

/** Shared state rendered by {@link ViewHost.renderState}, mirroring the workbench Vue state components. */
export type WorkbenchState =
  | {
    /** Nothing to show (no results, no selection). */
    kind: 'empty'
    /** Offline Carbon glyph name. */
    icon: string
    /** Short headline, no trailing period. */
    title: string
    /** Optional detail line. */
    detail?: string
  }
  | {
    /** Operation in progress. */
    kind: 'loading'
    /** Short headline naming the operation. */
    title: string
    /** Optional detail line. */
    detail?: string
  }
  | {
    /** Operation failed; announced as an alert. */
    kind: 'error'
    /** Offline Carbon glyph name; hosts default to an error glyph. */
    icon?: string
    /** Short headline naming the failed operation, no trailing period. */
    title: string
    /** Optional error detail. */
    detail?: string
  }

/** Lifecycle handle returned by a mounted view. */
export interface ViewHandle<C> {
  /** Called with each new context snapshot instead of remounting. */
  update?: (context: C) => void
  /** Releases everything the view created inside its container and overlay root. */
  dispose?: () => Awaitable<void>
}
