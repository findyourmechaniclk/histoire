import type { ReactViewComponent } from '@histoire/plugin-kit/react'
import type { ComponentType } from 'react'
import type { ReferenceModel } from '../domain/model.js'
import type { ReferenceViewFactory } from '../workbench/views.js'
import { reactView } from '@histoire/plugin-kit/react'
import { createElement } from 'react'
import { Diagnostics, Summary } from './Diagnostics.js'
import { Overview, Settings } from './Panels.js'

/**
 * Adds this plugin instance's model to the `{ context, host }` props `reactView` passes.
 * @param component React component taking `context` and `model`.
 * @param model Plugin state.
 */
function withModel<C>(component: ComponentType<{ context: C, model: ReferenceModel }>, model: ReferenceModel): ReactViewComponent<C> {
  return ({ context }) => createElement(component, { context, model })
}

/**
 * React implementation of the four panel views: each is a DOM `mount` view from `reactView`,
 * one React root per mounted view.
 * @param model Plugin state.
 */
export const createReactViews: ReferenceViewFactory = model => ({
  diagnostics: reactView(withModel(Diagnostics, model)),
  summary: reactView(withModel(Summary, model)),
  overview: reactView(withModel(Overview, model)),
  settings: reactView(withModel(Settings, model)),
})
