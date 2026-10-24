import type { MountedView, PluginDiagnostic, ViewMountOptions } from '../types/host.js'
import type { ViewMount } from '../types/view.js'
import type { RegistryEntry } from './registry.js'
import { createMountManager } from '../render/mount-manager.js'

/**
 * Mounted view that failed before mounting; `ready` rejects with the reason.
 * @param error Rejection reason.
 */
function failedView(error: Error): MountedView {
  const ready = Promise.reject(error)
  ready.catch(() => {})
  return { ready, update: () => {}, dispose: async () => {} }
}

/**
 * Creates the element a view uses for popovers when the caller owns none; it lives in the
 * container's document body for the view's lifetime.
 * @param container View container.
 * @param contributionId Owning contribution, exposed for debugging.
 */
function createOverlayRoot(container: HTMLElement, contributionId: string): HTMLElement {
  const element = container.ownerDocument.createElement('div')
  element.setAttribute('data-histoire-overlay-root', contributionId)
  container.ownerDocument.body.append(element)
  return element
}

/**
 * Mounts the DOM view of one committed contribution under its owner's generation.
 * Failures are recorded as diagnostics attributed to the contribution, then passed to
 * `options.onError` for mount and update so the caller shows a local error state.
 * @param entry Registry entry, or `undefined` when the id is unknown.
 * @param contributionId Qualified id, for errors.
 * @param container Caller container.
 * @param context Initial context snapshot.
 * @param options Overlay root and failure listener.
 * @param record Diagnostics sink of the host.
 */
export function mountContribution(
  entry: RegistryEntry | undefined,
  contributionId: string,
  container: HTMLElement,
  context: unknown,
  options: ViewMountOptions,
  record: (diagnostic: PluginDiagnostic) => void,
): MountedView {
  const view = entry?.contribution as { mount?: unknown, component?: unknown } | undefined
  if (!entry || !view) return failedView(new Error(`[histoire] no contribution "${contributionId}"`))
  if (typeof view.mount !== 'function') {
    return failedView(new Error(`[histoire] contribution "${contributionId}" has no DOM mount; ${view.component ? 'component views render through the workbench Vue outlet' : 'it is not a view'}`))
  }
  const pluginId = entry.contribution.pluginId
  const overlayRoot = options.overlayRoot ?? createOverlayRoot(container, contributionId)
  return createMountManager({
    mount: view.mount as ViewMount<unknown>,
    container,
    context,
    overlayRoot,
    signal: entry.owner,
    report(error, phase) {
      record({ pluginId, contributionId, phase, error })
      if (phase === 'mount' || phase === 'update') options.onError?.(error, phase)
    },
    onDispose: options.overlayRoot ? undefined : () => overlayRoot.remove(),
    renderState: options.renderState,
  })
}
