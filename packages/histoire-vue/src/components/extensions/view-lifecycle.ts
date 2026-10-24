import type { ExtensionHost, MountedView, QualifiedContribution, ViewFailurePhase, ViewHost, WorkbenchComponents, WorkbenchViewBinding } from '@histoire/plugin-kit'
import type { Component, ShallowRef } from 'vue'
import { WORKBENCH_VIEW_KEY } from '@histoire/plugin-kit'
import { onBeforeUnmount, onErrorCaptured, onMounted, provide, shallowRef, watch } from 'vue'
import { createViewStateRenderer } from './state-renderer.js'

/** View-bearing contribution fields read by the view lifecycle. */
interface ViewFields {
  /** Vue component view, rendered by the calling Vue app. */
  component?: Component
  /** Framework-neutral DOM mount, run by the extension host. */
  mount?: unknown
  /** Name used in loading and failure messages. */
  label?: string
  /** Name used in loading and failure messages (home sections). */
  title?: string
}

/** Inputs of {@link useExtensionView}. */
export interface ExtensionViewOptions {
  /** Host owning the contribution; records failures. */
  host: ExtensionHost
  /** Fixed for the component lifetime; key the component by contribution object. */
  contribution: QualifiedContribution
  /** Current surface context snapshot; watched, new snapshots update the view. */
  context: () => unknown
  /**
   * Element receiving this view's overlay root (themed layer of the surface). Returns
   * `undefined` while unresolvable (before mount); the root is then attached on mount.
   */
  overlayParent: () => HTMLElement | null | undefined
  /** Components rendering `ViewHost.renderState`; defaults to the ones provided around the view. */
  components?: WorkbenchComponents
}

/** Reactive state of one rendered contribution view. */
export interface ExtensionViewState {
  /** Contribution label or title, when it has one. */
  name: string | undefined
  /** Vue component view; `undefined` for DOM mount views. */
  component: Component | undefined
  /** Latest context snapshot; reactive so Vue views re-render on change. */
  current: ShallowRef<unknown>
  /** Set once the view failed; the view stays failed until remounted. */
  failure: ShallowRef<{ error: unknown } | undefined>
  /** Whether a DOM view is still mounting. */
  pending: ShallowRef<boolean>
  /** Template ref of the element DOM views mount into. */
  container: ShallowRef<HTMLElement | null | undefined>
  /** Called when the Vue view mounted; later Vue failures are update failures. */
  onComponentMounted: () => void
}

/**
 * Lifecycle of one contribution view, shared by the standalone workbench and native providers:
 * provides the `WorkbenchViewBinding` (live context + view host), keeps Vue view errors local and
 * attributed, mounts DOM views through the host's mount manager (which owns update ordering and
 * late disposal), pushes context snapshots without remounting, and releases everything on unmount.
 * Callers render the states (failure, pending, component, container) with their own components.
 * @param options Host, contribution, context source and overlay placement.
 */
export function useExtensionView(options: ExtensionViewOptions): ExtensionViewState {
  const { host, contribution } = options
  const { id } = contribution
  const view = contribution as ViewFields
  const current = shallowRef(options.context())
  const failure = shallowRef<{ error: unknown }>()
  const pending = shallowRef(!view.component)
  const container = shallowRef<HTMLElement | null>()
  const controller = new AbortController()
  let overlayRoot: HTMLElement | undefined
  let attached = false
  let mounted: MountedView | undefined
  let componentMounted = false
  const states = createViewStateRenderer(options.components)

  /** Appends the overlay root to its parent once that parent is known. */
  function attachOverlayRoot(): void {
    const parent = overlayRoot && !attached ? options.overlayParent() : undefined
    if (!parent || !overlayRoot) return
    parent.append(overlayRoot)
    attached = true
  }

  /** Per-view overlay element, created on first use so views without popovers add nothing. */
  function ensureOverlayRoot(): HTMLElement {
    if (!overlayRoot) {
      overlayRoot = document.createElement('div')
      overlayRoot.className = 'histoire-extension-overlay-root'
      overlayRoot.setAttribute('data-histoire-contribution', id)
      attachOverlayRoot()
    }
    return overlayRoot
  }

  const viewHost: ViewHost = {
    signal: controller.signal,
    get overlayRoot() {
      return ensureOverlayRoot()
    },
    reportError: (error) => {
      if (!controller.signal.aborted) host.reportViewError(id, error, 'report')
    },
    renderState: states.renderState,
  }
  provide(WORKBENCH_VIEW_KEY, {
    get context() {
      return current.value
    },
    host: viewHost,
  } satisfies WorkbenchViewBinding)

  /**
   * Shows the error state of this view only.
   * @param error View failure.
   */
  function fail(error: unknown): void {
    failure.value = { error }
    pending.value = false
  }

  // Errors below a Vue view stay here, attributed to the plugin.
  onErrorCaptured((error) => {
    if (failure.value) return false
    const phase: ViewFailurePhase = componentMounted ? 'update' : 'mount'
    host.reportViewError(id, error, phase)
    fail(error)
    return false
  })

  onMounted(() => {
    attachOverlayRoot()
    if (view.component || !container.value) return
    mounted = host.mount(id, container.value, current.value, { overlayRoot: ensureOverlayRoot(), onError: fail, renderState: states.renderState })
    mounted.ready.then(() => {
      pending.value = false
    }, () => {})
  })

  watch(options.context, (context) => {
    current.value = context
    mounted?.update(context)
  })

  onBeforeUnmount(() => {
    controller.abort()
    states.release()
    void mounted?.dispose()
    overlayRoot?.remove()
  })

  return {
    name: view.label ?? view.title,
    component: view.component,
    current,
    failure,
    pending,
    container,
    onComponentMounted: () => {
      componentMounted = true
    },
  }
}
