import type { ContributionView, FrameScopedContext, WorkbenchContext } from '@histoire/plugin-kit'
import type { ReferenceModel } from '../domain/model.js'

/**
 * Panel views each UI variant implements. Contributions and canvas views are shared; only these
 * four bodies differ between workbench Vue, DOM, React and Svelte 5.
 */
export interface ReferenceViews {
  /** Inspector tab: issues of the selected frame. */
  diagnostics: ContributionView<FrameScopedContext>
  /** Inspector section: one-line status of the selected frame. */
  summary: ContributionView<FrameScopedContext>
  /** Rail pane and home section: every audited frame. */
  overview: ContributionView<WorkbenchContext>
  /** Settings section and toolbar popover: preferences. */
  settings: ContributionView<WorkbenchContext>
}

/** Builds one variant's views around a plugin instance's state. */
export type ReferenceViewFactory = (model: ReferenceModel) => ReferenceViews

/** Qualified id of the inspector tab, for navigation. */
export const AUDIT_TAB_ID = 'reference:audit'
