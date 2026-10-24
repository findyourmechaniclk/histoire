// Registers every contribution kind; UI variants only supply the four panel views.
import type { WorkbenchPluginApi } from '@histoire/plugin-kit'
import type { ReferenceModel } from '../domain/model.js'
import type { ReferenceViewFactory, ReferenceViews } from './views.js'
import { defineWorkbenchPlugin } from '@histoire/plugin-kit'
import { createReferenceModel } from '../domain/model.js'
import { REFERENCE_PLUGIN_ID } from '../options.js'
import { annotationLayer } from './canvas/annotation-layer.js'
import { compareView } from './canvas/compare-view.js'
import { frameBadge } from './canvas/frame-badge.js'
import { registerActions } from './register-actions.js'
import { installReferenceStyles } from './styles.js'

/**
 * Panels, inspector and canvas contributions.
 * @param api Plugin API.
 * @param model Plugin state.
 * @param views Panel views of the chosen UI variant.
 */
function registerSurfaces(api: WorkbenchPluginApi, model: ReferenceModel, views: ReferenceViews): void {
  api.inspector.addTab({ id: 'audit', label: 'Audit', icon: 'list-checked', badge: context => model.audits.get(context.frame.key)?.report?.issues.length || null, ...views.diagnostics })
  // Reports arrive from frames, outside any state the host observes: `invalidate` re-reads the badge.
  model.audits.subscribe(() => api.invalidate())
  api.inspector.addSection({ id: 'summary', tab: 'builtin:props', position: 'after', ...views.summary })
  api.shell.addPane({ id: 'overview', label: 'Audit', icon: 'list-checked', ...views.overview })
  api.settings.addSection({ id: 'settings', label: 'Audit', icon: 'list-checked', ...views.settings })
  api.home.addSection({ id: 'home', column: 'secondary', title: 'Audit', ...views.overview })
  api.canvas.addOverlay({ id: 'annotations', space: 'canvas', ...annotationLayer(model) })
  api.canvas.addFrameOverlay({ id: 'badge', ...frameBadge(model) })
  api.canvas.addTool({ id: 'annotate', label: 'Annotate', icon: 'edit', cursor: 'crosshair', shortcut: ['a'], ...model.draft.handlers })
  api.canvas.addView({ id: 'compare', label: 'Compare', icon: 'compare', ...compareView(model) })
}

/**
 * Defines the reference workbench plugin with one UI variant's views.
 * @param createViews View factory of the UI variant.
 */
export function defineReferencePlugin(createViews: ReferenceViewFactory) {
  return defineWorkbenchPlugin({
    id: REFERENCE_PLUGIN_ID,
    apiVersion: 1,
    setup(api) {
      installReferenceStyles(api.signal)
      const model = createReferenceModel(api)
      const views = createViews(model)
      registerSurfaces(api, model, views)
      registerActions(api, model, views.settings)
      // Registrations, channels and preference subscriptions are released with the plugin;
      // nothing else to dispose here.
    },
  })
}
