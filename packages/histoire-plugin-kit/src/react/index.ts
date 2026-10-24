// React adapter built on the DOM mount contract; must never import vue or svelte.
import type { ComponentType } from 'react'
import type { MountView, ViewHost } from '../types/view.js'
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

/** Props a React view component receives. */
export interface ReactViewProps<C> {
  /** Current context snapshot. */
  context: C
  /** Host services; render popovers with `createPortal(..., host.overlayRoot)`. */
  host: ViewHost
}

/** React component rendered as a workbench view. */
export type ReactViewComponent<C> = ComponentType<ReactViewProps<C>>

/**
 * Wraps a React component as a DOM `mount` view: one React root per container. Context
 * updates re-render the same root; disposal unmounts it, portals and effects included.
 * Renders synchronously so the view is in the DOM once the mount settles.
 * @param component Component rendered with the surface context.
 */
export function reactView<C>(component: ReactViewComponent<C>): MountView<C> {
  return {
    mount(container, context, host) {
      const root = createRoot(container)
      /** Renders one snapshot synchronously. */
      const render = (next: C) => flushSync(() => root.render(createElement(component, { context: next, host })))
      render(context)
      return {
        update: render,
        dispose() {
          root.unmount()
        },
      }
    },
  }
}
