import type { WorkbenchComponent, WorkbenchState } from '../types/view.js'

/**
 * Provide/inject key under which a Vue host provides its {@link WorkbenchComponents}.
 *
 * Registered with `Symbol.for` so the workbench, native hosts and a plugin's own copy of
 * plugin-kit agree on it without importing each other.
 */
export const WORKBENCH_COMPONENTS_KEY: symbol = Symbol.for('histoire.plugin-kit.workbench-components')

/**
 * Host implementations of the shared workbench state and pane layout components, keyed by the
 * names `@histoire/plugin-kit/vue` exports. Missing entries render plugin-kit's plain fallback.
 */
export interface WorkbenchComponents {
  /** Empty area: props `icon`, `title`; slots `default` (detail), `actions`. */
  WorkbenchEmptyState?: WorkbenchComponent
  /** Loading placeholder: prop `title`; slot `default` (detail). */
  WorkbenchLoadingState?: WorkbenchComponent
  /** Failure: props `title`, optional `icon`; slots `default` (detail), `actions`. */
  WorkbenchErrorState?: WorkbenchComponent
  /** Fixed-height pane header: prop `title`; slot `default` (trailing actions). */
  WorkbenchPaneHeader?: WorkbenchComponent
  /** Filter or section switch row: slot `default`. */
  WorkbenchPaneToolbar?: WorkbenchComponent
  /** Scrolling list body inset by the pane gutter: slot `default`. */
  WorkbenchPaneList?: WorkbenchComponent
}

/**
 * Renders `state` into `container` as plain, unstyled markup (title and detail inside a
 * `status` or `alert` region), replacing its children; `null` empties it. Used for DOM views
 * whose host has no styled renderer.
 * @param container Element owned by the view.
 * @param state State to show, or `null` to clear.
 */
export function renderPlainWorkbenchState(container: HTMLElement, state: WorkbenchState | null): void {
  if (!state) {
    container.replaceChildren()
    return
  }
  const document = container.ownerDocument
  const region = document.createElement('div')
  region.setAttribute('role', state.kind === 'error' ? 'alert' : 'status')
  region.setAttribute('data-histoire-state', state.kind)
  const title = document.createElement('strong')
  title.textContent = state.title
  region.append(title)
  if (state.detail) {
    const detail = document.createElement('p')
    detail.textContent = state.detail
    region.append(detail)
  }
  container.replaceChildren(region)
}
