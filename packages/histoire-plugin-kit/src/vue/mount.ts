// Isolated-app Vue adapter for hosts that do not run the workbench Vue (rare: a native React
// host rendering a Vue plugin view). Inside the workbench, use `{ component }` instead.
import type { Component } from 'vue'
import type { WorkbenchViewBinding } from '../render/view-binding.js'
import type { MountView, ViewHost, WorkbenchComponent } from '../types/view.js'
import { createApp, h, shallowRef } from 'vue'
import { WORKBENCH_VIEW_KEY } from '../render/view-binding.js'

/**
 * Wraps a Vue component as a DOM `mount` view rendered in its own Vue app. The component
 * receives `context` as a prop and through `useWorkbenchContext()`; updates re-render it
 * without remounting.
 * @param component Vue component receiving a `context` prop.
 */
export function vueView<C>(component: WorkbenchComponent): MountView<C> {
  return {
    mount(container, context, host: ViewHost) {
      const current = shallowRef(context)
      const binding: WorkbenchViewBinding<C> = {
        get context() {
          return current.value
        },
        host,
      }
      const app = createApp({ render: () => h(component as Component, { context: current.value }) })
      app.provide(WORKBENCH_VIEW_KEY, binding)
      app.mount(container)
      return {
        update(next) {
          current.value = next
        },
        dispose() {
          app.unmount()
        },
      }
    },
  }
}
