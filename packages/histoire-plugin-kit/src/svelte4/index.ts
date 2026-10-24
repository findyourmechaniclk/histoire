// Svelte 4 adapter built on the DOM mount contract; must never import vue or react.
// It needs no `svelte` import: Svelte 4 components are self-mounting classes.
import type { MountView, ViewHost } from '../types/view.js'

/** Props a Svelte 4 view component receives. */
export interface Svelte4ViewProps<C> {
  /** Current context snapshot. */
  context: C
  /** Host services; place popovers in `host.overlayRoot`. */
  host: ViewHost
}

/** Instance API of a Svelte 4 component used by the adapter. */
export interface Svelte4ViewInstance<C> {
  /** Updates props. */
  $set: (props: Partial<Svelte4ViewProps<C>>) => void
  /** Destroys the component. */
  $destroy: () => void
}

/** Svelte 4 component class rendered as a workbench view. */
export type Svelte4ViewComponent<C> = new (options: { target: Element, props?: Svelte4ViewProps<C> }) => Svelte4ViewInstance<C>

/**
 * Wraps a Svelte 4 component as a DOM `mount` view: `new Component({ target, props })`,
 * `$set` on context updates, `$destroy` on disposal.
 * @param Component Component rendered with the surface context.
 */
export function svelte4View<C>(Component: Svelte4ViewComponent<C>): MountView<C> {
  return {
    mount(container, context, host) {
      const instance = new Component({ target: container, props: { context, host } })
      return {
        update: next => instance.$set({ context: next }),
        dispose: () => instance.$destroy(),
      }
    },
  }
}
