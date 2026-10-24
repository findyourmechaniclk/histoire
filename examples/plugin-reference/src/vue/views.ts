import type { ComponentView } from '@histoire/plugin-kit'
import type { Component } from 'vue'
import type { ReferenceModel } from '../domain/model.js'
import type { ReferenceViewFactory } from '../workbench/views.js'
import { defineWorkbenchComponent } from '@histoire/plugin-kit/vue'
import { defineComponent, h } from 'vue'
import DiagnosticsTab from './DiagnosticsTab.vue'
import OverviewList from './OverviewList.vue'
import SettingsPanel from './SettingsPanel.vue'
import SummarySection from './SummarySection.vue'

/**
 * Workbench Vue view: renders `component` with the `context` prop the workbench passes, plus
 * this plugin instance's model.
 * @param component SFC taking `context` and `model` props.
 * @param model Plugin state.
 */
function bind(component: Component, model: ReferenceModel): ComponentView {
  return {
    component: defineWorkbenchComponent(defineComponent({
      name: 'ReferenceView',
      props: { context: { type: Object, required: true } },
      setup: props => () => h(component, { context: props.context, model }),
    })),
  }
}

/**
 * Workbench Vue implementation of the four panel views.
 * @param model Plugin state.
 */
export const createVueViews: ReferenceViewFactory = model => ({
  diagnostics: bind(DiagnosticsTab, model),
  summary: bind(SummarySection, model),
  overview: bind(OverviewList, model),
  settings: bind(SettingsPanel, model),
})
