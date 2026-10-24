// Workbench-Vue helpers. Inside the workbench, `vue` resolves to the workbench's own Vue
// for plugin code (see histoire/src/node/vite/workbench-vue.ts), so injection works.
import type { WorkbenchViewBinding } from '../render/view-binding.js'
import type { WorkbenchContext } from '../types/context.js'
import type { ViewHost, WorkbenchComponent } from '../types/view.js'
import { inject } from 'vue'
import { WORKBENCH_VIEW_KEY } from '../render/view-binding.js'

export { WorkbenchEmptyState, WorkbenchErrorState, WorkbenchLoadingState, WorkbenchPaneHeader, WorkbenchPaneList, WorkbenchPaneToolbar } from './components.js'

/**
 * Types a Vue component as a workbench view component (receives a `context` prop).
 * Identity at runtime.
 * @param component Vue component compiled against the workbench Vue.
 */
export function defineWorkbenchComponent<T extends WorkbenchComponent>(component: T): T {
  return component
}

/** Binding of the nearest workbench view; throws outside one. */
function useBinding<C>(): WorkbenchViewBinding<C> {
  const binding = inject<WorkbenchViewBinding<C> | null>(WORKBENCH_VIEW_KEY, null)
  if (!binding) throw new Error('[histoire plugin] workbench view helpers must be called in the setup of a component rendered as a workbench view')
  return binding
}

/**
 * Reads the surface context inside a workbench Vue view component, at any depth.
 *
 * The returned object is a live view of the current snapshot: each property read goes to
 * the latest context the host pushed, and reads during render re-render on change.
 * Methods are bound to the snapshot they were read from.
 */
export function useWorkbenchContext<C extends WorkbenchContext = WorkbenchContext>(): C {
  const binding = useBinding<C>()
  return new Proxy({} as C, {
    get(_, key) {
      const context = binding.context as object
      const value = Reflect.get(context, key, context)
      return typeof value === 'function' ? value.bind(context) : value
    },
    has: (_, key) => Reflect.has(binding.context as object, key),
    ownKeys: () => Reflect.ownKeys(binding.context as object),
    getOwnPropertyDescriptor(_, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(binding.context as object, key)
      // The empty proxy target holds no properties, so every reported one must be configurable.
      return descriptor && { ...descriptor, configurable: true }
    },
  })
}

/** Host services of the enclosing workbench view: abort signal, overlay root, error reporting. */
export function useViewHost(): ViewHost {
  return useBinding().host
}
