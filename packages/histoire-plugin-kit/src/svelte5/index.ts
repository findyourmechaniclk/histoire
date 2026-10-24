// Svelte 5 adapter built on the DOM mount contract; must never import vue or react.
import type { Component } from 'svelte'
import type { MountView, ViewHost } from '../types/view.js'
import { mount, unmount } from 'svelte'
import { createSubscriber } from 'svelte/reactivity'

/** Props a Svelte 5 view component receives. */
export interface Svelte5ViewProps<C> {
  /** Current context snapshot. */
  readonly context: C
  /** Host services; place popovers in `host.overlayRoot`. */
  readonly host: ViewHost
}

/** Svelte 5 component rendered as a workbench view. */
export type Svelte5ViewComponent<C> = Component<Svelte5ViewProps<C>>

/**
 * Wraps a Svelte 5 component as a DOM `mount` view (Svelte 5.7+).
 *
 * Props are a plain object whose `context` getter reads a `createSubscriber` signal, so
 * template effects reading `context` re-run when the host pushes a snapshot, without
 * remounting and without compiling runes into this package.
 * @param component Component rendered with the surface context.
 */
export function svelte5View<C>(component: Svelte5ViewComponent<C>): MountView<C> {
  return {
    mount(container, context, host) {
      let current = context
      let notify: (() => void) | undefined
      // Start runs when the first effect reads `context`; its update re-runs every reader.
      const track = createSubscriber((update) => {
        notify = update
        return () => {
          notify = undefined
        }
      })
      const props: Svelte5ViewProps<C> = {
        get context() {
          track()
          return current
        },
        host,
      }
      const instance = mount(component, { target: container, props })
      return {
        update(next) {
          current = next
          notify?.()
        },
        dispose: () => unmount(instance),
      }
    },
  }
}
