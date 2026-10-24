import type { HistoireJsonValue } from '@histoire/protocol'
import type { Disposer } from './common.js'
import type { WorkbenchContext } from './context.js'
import type { ContributionKind, ContributionOfKind, QualifiedContribution, WorkbenchContribution } from './contribution.js'
import type { WorkbenchPluginDefinition } from './plugin.js'
import type { StorageLike } from './preferences.js'
import type { ViewHost } from './view.js'

/** Plugin entry passed to a host, optionally with browser-visible options. */
export type ExtensionHostPlugin =
  | WorkbenchPluginDefinition
  | { definition: WorkbenchPluginDefinition, options?: HistoireJsonValue }

/** Services a host builds plugin APIs from. Absent optional services become capabilities reported unavailable. */
export interface ExtensionHostServices {
  /** Root-scoped context handed to plugins as `api.context`. */
  context: WorkbenchContext
  /** Preference storage; memory fallback when absent. */
  storage?: StorageLike
  /** Namespace separating preferences of different projects sharing one storage. */
  storageNamespace?: string
}

/** Options for `createExtensionHost`. */
export interface ExtensionHostOptions {
  /** Plugins in config order. */
  plugins: ReadonlyArray<ExtensionHostPlugin>
  /** Host services. */
  services: ExtensionHostServices
}

/**
 * Phase in which a plugin failure happened. `callback` covers plugin callbacks the host
 * invokes outside a view or action (availability predicates, preference listeners);
 * `report` covers errors the plugin passed to `reportError`.
 */
export type PluginDiagnosticPhase = 'load' | 'setup' | 'register' | 'mount' | 'update' | 'run' | 'dispose' | 'callback' | 'report'

/** Surface context a contribution kind's `available` predicate receives. */
export type ContributionContext<K extends ContributionKind> = ContributionOfKind<K> extends { available?: (context: infer C) => boolean } ? C : never

/** Per-invocation options of `ExtensionHost.run`. */
export interface ExtensionRunOptions {
  /** Captured target scope; aborting it aborts the action and discards its result. */
  signal?: AbortSignal
}

/** Attributed plugin failure; never retried. */
export interface PluginDiagnostic {
  /** Failing plugin. */
  readonly pluginId: string
  /** Qualified contribution id, when the failure belongs to one. */
  readonly contributionId?: string
  /** Lifecycle phase. */
  readonly phase: PluginDiagnosticPhase
  /** Original error. */
  readonly error: unknown
}

/** View mounted by the host into a caller container. */
export interface MountedView {
  /** Resolves once the view mounted, or rejects with its mount error. */
  readonly ready: Promise<void>
  /** Pushes a new context snapshot; snapshots pushed while mounting are applied after it. */
  update: (context: unknown) => void
  /** Disposes the view; safe to call repeatedly. */
  dispose: () => Promise<void>
}

/** View lifecycle phase a view failure belongs to. */
export type ViewFailurePhase = 'mount' | 'update'

/** Per-mount options of `ExtensionHost.mount`. */
export interface ViewMountOptions {
  /**
   * Element for the view's popovers and menus, inside the caller's theme scope.
   * Defaults to an element appended to the container's document body for the view's lifetime.
   */
  overlayRoot?: HTMLElement
  /**
   * Notified of each failure after it is recorded as a diagnostic, so the caller can show
   * the error state for this view only. A failed update disposes the view.
   */
  onError?: (error: unknown, phase: ViewFailurePhase) => void
  /** Styled renderer behind the view's `ViewHost.renderState`; defaults to plain markup. */
  renderState?: ViewHost['renderState']
}

/** Per-workbench owner of plugin setup, registry, preferences, diagnostics and teardown. */
export interface ExtensionHost {
  /** Resolves when all plugin setups settled (success or attributed failure). */
  readonly ready: Promise<void>
  /** Ordered committed contributions of one kind; the same frozen array until a commit changes the kind. */
  contributions: <K extends ContributionKind>(kind: K) => ReadonlyArray<QualifiedContribution<K>>
  /**
   * Ordered committed contributions of one kind available in `context`: `available` passes and
   * `devOnly` entries only for dev sources. A throwing predicate hides its contribution for good.
   */
  available: <K extends ContributionKind>(kind: K, context: ContributionContext<K>) => ReadonlyArray<QualifiedContribution<K>>
  /** Registers a `builtin:`-qualified contribution owned by the embedding app; plugins cannot use the namespace. */
  registerBuiltin: (contribution: WorkbenchContribution) => Disposer
  /**
   * Notified after registry commits (never per provisional registration), after root context
   * changes (availability may change) and after new diagnostics.
   */
  subscribe: (listener: () => void) => Disposer
  /**
   * Mounts the DOM `mount` view of a contribution into `container`. The view is disposed when
   * the returned handle, its plugin or the host retires. Workbench Vue `component` views render
   * through the embedding Vue app instead; mounting one rejects `ready`.
   */
  mount: (contributionId: string, container: HTMLElement, context: unknown, options?: ViewMountOptions) => MountedView
  /**
   * Records a failure of a view the embedding app rendered itself (workbench Vue `component`
   * views), attributed to the contribution's plugin. `report` is for errors the view passed to
   * its `ViewHost.reportError`. Ignored for unknown contributions and after disposal.
   */
  reportViewError: (contributionId: string, error: unknown, phase: ViewFailurePhase | 'report') => void
  /**
   * Runs an action contribution against a captured context. Frame-menu children are addressed
   * as `${itemId}:${childId}` (`acme:export:json`). Rejects with the action error
   * (also recorded as a diagnostic); resolves without a result when the plugin, the host or
   * `options.signal` retired before the action settled.
   */
  run: (contributionId: string, context: unknown, options?: ExtensionRunOptions) => Promise<void>
  /** Attributed failures recorded so far. */
  diagnostics: () => ReadonlyArray<PluginDiagnostic>
  /** Disposes every plugin and registration exactly once. */
  dispose: () => Promise<void>
}
