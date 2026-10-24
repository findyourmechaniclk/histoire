import type { MountView } from '@histoire/plugin-kit'
import type { Svelte5ViewComponent, Svelte5ViewProps } from '@histoire/plugin-kit/svelte5'
import type { Component } from 'svelte'
import type { ReferenceModel } from '../domain/model.js'
import type { ReferenceViewFactory } from '../workbench/views.js'
import { svelte5View } from '@histoire/plugin-kit/svelte5'
import Diagnostics from './Diagnostics.svelte'
import Overview from './Overview.svelte'
import Settings from './Settings.svelte'
import Summary from './Summary.svelte'

/**
 * Adds this plugin instance's model to the props `svelte5View` passes. The props object is
 * extended in place rather than copied: its `context` getter is what makes `context` reactive.
 * @param component Svelte 5 component taking `context` and `model`.
 * @param model Plugin state.
 */
function withModel<C>(component: Component<any>, model: ReferenceModel): MountView<C> {
  const bound = ((anchor: unknown, props: Svelte5ViewProps<C>) => component(anchor as any, Object.defineProperty(props, 'model', { value: model, enumerable: true }))) as Svelte5ViewComponent<C>
  return svelte5View(bound)
}

/**
 * Svelte 5 implementation of the four panel views (`svelte5View`, Svelte 5.7+).
 * @param model Plugin state.
 */
export const createSvelteViews: ReferenceViewFactory = model => ({
  diagnostics: withModel(Diagnostics, model),
  summary: withModel(Summary, model),
  overview: withModel(Overview, model),
  settings: withModel(Settings, model),
})
