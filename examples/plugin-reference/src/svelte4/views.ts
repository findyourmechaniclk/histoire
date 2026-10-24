import type { MountView } from '@histoire/plugin-kit'
import type { Svelte4ViewComponent, Svelte4ViewProps } from '@histoire/plugin-kit/svelte4'
import type { ReferenceModel } from '../domain/model.js'
import type { ReferenceViewFactory } from '../workbench/views.js'
import { svelte4View } from '@histoire/plugin-kit/svelte4'
import Diagnostics from './Diagnostics.svelte'
import Overview from './Overview.svelte'
import Settings from './Settings.svelte'
import Summary from './Summary.svelte'

/** Constructor options of a Svelte 4 component class. */
type Svelte4Options<C> = ConstructorParameters<Svelte4ViewComponent<C>>[0]

/**
 * Adds this plugin instance's model to the `{ context, host }` props `svelte4View` passes. A
 * subclass injects it at construction; later `$set({ context })` calls leave it untouched.
 * @param component Svelte 4 component class taking `context` and `model`.
 * @param model Plugin state.
 */
function withModel<C>(component: unknown, model: ReferenceModel): MountView<C> {
  // The ambient `*.svelte` declaration types Svelte 5 components; these files compile to Svelte 4 classes.
  const Component = component as Svelte4ViewComponent<C>
  /** Component class mounting with `model` added to its props. */
  class Bound extends Component {
    /**
     * Mounts the component with the model added to its props.
     * @param options Target and props from `svelte4View`.
     */
    constructor(options: Svelte4Options<C>) {
      super({ ...options, props: { ...options.props, model } as Svelte4ViewProps<C> })
    }
  }
  return svelte4View(Bound)
}

/**
 * Svelte 4 implementation of the four panel views (`svelte4View`). The components are compiled
 * by the Svelte 4 compiler and import the project's `svelte` runtime, so this variant runs in
 * Svelte 4 story projects (where `svelte` is deduped to Svelte 4).
 * @param model Plugin state.
 */
export const createSvelte4Views: ReferenceViewFactory = model => ({
  diagnostics: withModel(Diagnostics, model),
  summary: withModel(Summary, model),
  overview: withModel(Overview, model),
  settings: withModel(Settings, model),
})
