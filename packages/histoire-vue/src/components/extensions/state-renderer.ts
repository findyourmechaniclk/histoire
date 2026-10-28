import type { ViewHost, WorkbenchComponents, WorkbenchState } from '@histoire/plugin-kit'
import type { Component } from 'vue'
import { LoadingDelayBoundary, useLoadingDelay } from '@histoire/controls/vue'
import { cancelPlainLoadingState, renderPlainWorkbenchState, WORKBENCH_COMPONENTS_KEY } from '@histoire/plugin-kit'
import { defineComponent, getCurrentInstance, h, inject, render } from 'vue'

/** Delays plugin-provided loading markup once, including host-supplied components. */
const DelayedState = defineComponent({
  setup(_props, { slots }) {
    const visible = useLoadingDelay(true)
    return () => visible.value ? h(LoadingDelayBoundary, null, slots.default) : null
  },
})

/** Provided component rendering each state kind. */
const STATE_COMPONENTS = {
  empty: 'WorkbenchEmptyState',
  loading: 'WorkbenchLoadingState',
  error: 'WorkbenchErrorState',
} as const satisfies Record<WorkbenchState['kind'], keyof WorkbenchComponents>

/** State renderer of one view and the cleanup releasing what it rendered. */
export interface ViewStateRenderer {
  /** `ViewHost.renderState` of the view. */
  renderState: ViewHost['renderState']
  /** Unmounts every state still rendered; later calls render nothing. */
  release: () => void
}

/**
 * Creates the `renderState` of one view, called in the view component's setup. States render
 * with the given workbench components, else the ones provided around the view (native), as
 * separate Vue roots inside plugin-owned elements that share the view's app context; without
 * components they render plain markup.
 * @param given Components of the calling workbench.
 */
export function createViewStateRenderer(given?: WorkbenchComponents): ViewStateRenderer {
  const components = given ?? inject<WorkbenchComponents | null>(WORKBENCH_COMPONENTS_KEY, null)
  const appContext = getCurrentInstance()?.appContext ?? null
  // Containers currently holding a Vue root; others hold plain markup or plugin content.
  const roots = new Set<HTMLElement>()
  const plain = new Set<HTMLElement>()
  let released = false

  /**
   * Unmounts the Vue root in `container`, if any.
   * @param container Plugin-owned element.
   */
  function unmountRoot(container: HTMLElement): void {
    if (roots.delete(container)) render(null, container)
  }

  return {
    renderState(container, state) {
      if (released) return
      const component = state && components?.[STATE_COMPONENTS[state.kind]] as Component | undefined
      if (!state || !component) {
        unmountRoot(container)
        plain.add(container)
        renderPlainWorkbenchState(container, state)
        return
      }
      const { kind, detail, ...props } = state
      cancelPlainLoadingState(container)
      plain.delete(container)
      const stateNode = () => h(component, props, detail ? { default: () => detail } : undefined)
      const vnode = kind === 'loading' ? h(DelayedState, null, stateNode) : stateNode()
      // Same app context as the view: global components, directives and app-level provides.
      vnode.appContext = appContext
      // A first Vue render appends; replace plugin content or plain markup instead.
      if (!roots.has(container)) container.replaceChildren()
      render(vnode, container)
      roots.add(container)
    },
    release() {
      released = true
      for (const container of [...roots]) unmountRoot(container)
      for (const container of plain) cancelPlainLoadingState(container)
      plain.clear()
    },
  }
}
