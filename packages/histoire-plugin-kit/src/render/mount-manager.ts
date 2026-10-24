import type { MountedView } from '../types/host.js'
import type { ViewHandle, ViewHost, ViewMount } from '../types/view.js'
import { createScope } from '../host/generation.js'
import { renderPlainWorkbenchState } from './workbench-components.js'

/** Failure kinds a mount manager reports; `report` comes from the view's own `reportError`. */
export type MountFailurePhase = 'mount' | 'update' | 'dispose' | 'report'

/** Inputs of one DOM view lifecycle. */
export interface MountManagerOptions<C> {
  /** View mount function. */
  mount: ViewMount<C>
  /** Host-owned container; the view owns its children. */
  container: HTMLElement
  /** Initial context snapshot. */
  context: C
  /** Element for the view's popovers and menus. */
  overlayRoot: HTMLElement
  /** Owner generation (plugin, host); its retirement disposes the view. */
  signal?: AbortSignal
  /** Receives every failure; never throws back into the manager. */
  report: (error: unknown, phase: MountFailurePhase) => void
  /** Runs once after the view (if attached) is disposed. */
  onDispose?: () => void
  /** Host renderer of workbench states; plain markup when absent. */
  renderState?: ViewHost['renderState']
}

/**
 * Runs one DOM `mount` view: mount, serialized updates, error capture and disposal.
 *
 * Each manager owns a generation scope linked to its owner. The view's `host.signal` aborts
 * when the manager is disposed or the owner retires. A mount that completes after that is
 * never attached: its handle is disposed immediately and receives no update. Snapshots pushed
 * while the mount is pending are coalesced and only the latest is applied once it completes.
 * A failed mount or update marks the view failed; a failed update also disposes it, since
 * its state is unknown.
 * @param options View, container, context and reporting.
 */
export function createMountManager<C>(options: MountManagerOptions<C>): MountedView {
  const { report } = options
  const scope = createScope(options.signal)
  let handle: ViewHandle<C> | undefined
  let failed = false
  let queued: { context: C } | undefined
  let disposal: Promise<void> | undefined

  const viewHost: ViewHost = {
    signal: scope.signal,
    overlayRoot: options.overlayRoot,
    reportError: (error) => {
      if (scope.active) report(error, 'report')
    },
    renderState: options.renderState ?? renderPlainWorkbenchState,
  }

  /**
   * Disposes one handle, capturing its failure.
   * @param target Handle returned by the mount.
   */
  async function disposeHandle(target: ViewHandle<C>): Promise<void> {
    try {
      await target.dispose?.()
    }
    catch (error) {
      report(error, 'dispose')
    }
  }

  /**
   * Pushes a snapshot to the attached view; a throwing update fails and disposes the view.
   * @param context Snapshot.
   */
  function apply(context: C): void {
    if (!handle || failed || !scope.active) return
    try {
      handle.update?.(context)
    }
    catch (error) {
      failed = true
      report(error, 'update')
      void dispose()
    }
  }

  /** Retires the scope, then disposes the attached view, if any. Idempotent and reentrant. */
  function dispose(): Promise<void> {
    if (disposal) return disposal
    // Placeholder first: retiring fires the owner-abort listener, which calls back here.
    disposal = Promise.resolve()
    scope.retire()
    const attached = handle
    handle = undefined
    queued = undefined
    disposal = (attached ? disposeHandle(attached) : Promise.resolve()).then(() => options.onDispose?.())
    return disposal
  }

  let result: ReturnType<ViewMount<C>>
  try {
    result = options.mount(options.container, options.context, viewHost)
  }
  catch (error) {
    result = Promise.reject(error)
  }

  const ready = Promise.resolve(result).then(
    (value) => {
      const attached: ViewHandle<C> = value ?? {}
      if (!scope.active) {
        // Late completion of a retired generation: release it, never attach it.
        void disposeHandle(attached)
        return
      }
      handle = attached
      if (queued) {
        const { context } = queued
        queued = undefined
        apply(context)
      }
    },
    (error) => {
      // A failure after retirement belongs to a generation nobody observes anymore.
      if (!scope.active) return
      failed = true
      report(error, 'mount')
      throw error
    },
  )
  // Callers may never await `ready`; a mount failure is already reported.
  ready.catch(() => {})
  scope.signal.addEventListener('abort', () => void dispose(), { once: true })

  return {
    ready,
    update(context) {
      if (failed || !scope.active) return
      if (handle) apply(context as C)
      else queued = { context: context as C }
    },
    dispose,
  }
}
