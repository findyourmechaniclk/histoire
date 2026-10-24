import type { ViewHost } from '../types/view.js'

/**
 * Provide/inject key of the {@link WorkbenchViewBinding} around each Vue view.
 *
 * Registered with `Symbol.for` so separate copies of plugin-kit (the workbench's and a
 * plugin's own install) agree on it; the key itself carries no framework dependency.
 */
export const WORKBENCH_VIEW_KEY: symbol = Symbol.for('histoire.plugin-kit.workbench-view')

/**
 * What a Vue view host provides under {@link WORKBENCH_VIEW_KEY}. Providers back `context`
 * with reactive state, so reads made during render track context changes.
 */
export interface WorkbenchViewBinding<C = unknown> {
  /** Current context snapshot of the view's surface. */
  readonly context: C
  /** Host services of the view. */
  readonly host: ViewHost
}
