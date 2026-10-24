// DOM variant: framework-neutral `mount` views. Each view re-renders its container from the
// shared view state; context snapshots arrive through `update`, so the view never remounts.
import type { FrameScopedContext, MountView, WorkbenchContext, WorkbenchState } from '@histoire/plugin-kit'
import type { ReferenceModel } from '../domain/model.js'
import type { ReferenceViewFactory } from '../workbench/views.js'
import { diagnosticsState, overviewRows, settingsState, subscribeViewState } from '../domain/view-state.js'
import { AUDIT_TAB_ID } from '../workbench/views.js'
import { h } from './h.js'

/** Returns the view's state element showing `state`, rendered by the host's state components. */
type ShowState = (state: WorkbenchState) => Node

/**
 * Builds a `mount` view that renders `render(context)` into its container on mount, on every
 * context update and on every model change. Focus survives re-renders through `data-focus`
 * keys, so keyboard users keep their place after toggling or clicking.
 * @param model Plugin state.
 * @param render Produces the view's children.
 */
function domView<C>(model: ReferenceModel, render: (context: C, showState: ShowState) => Node[]): MountView<C> {
  return {
    mount(container, initial, host) {
      let context = initial
      const root = h('div', { class: 'hst-ref-panel' })
      // One element per view: the host re-renders it in place, so redraws never stack states.
      const stateElement = h('div')
      const showState: ShowState = (state) => {
        host.renderState(stateElement, state)
        return stateElement
      }
      container.append(root)
      const draw = () => {
        const focused = root.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined
        root.replaceChildren(...render(context, showState))
        if (focused) root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focused)}"]`)?.focus()
      }
      const stop = subscribeViewState(model, draw)
      draw()
      return {
        update(next) {
          context = next
          draw()
        },
        dispose() {
          stop()
          host.renderState(stateElement, null)
        },
      }
    },
  }
}

/**
 * Plain button.
 * @param focus Stable focus key.
 * @param label Visible label.
 * @param onClick Click handler.
 * @param disabled Disabled state.
 */
function button(focus: string, label: string, onClick: () => void, disabled = false): HTMLElement {
  return h('button', { 'class': 'hst-ref-button', 'type': 'button', 'data-focus': focus, disabled, onClick }, label)
}

/**
 * Inspector tab body.
 * @param model Plugin state.
 * @param context Frame-scoped context.
 * @param showState Renders the empty state.
 */
function diagnostics(model: ReferenceModel, context: FrameScopedContext, showState: ShowState): Node[] {
  const state = diagnosticsState(model, context)
  const header = h('div', { class: 'hst-ref-row' }, h('span', { class: 'hst-ref-grow' }, state.status), button('rerun', 'Run again', () => model.audits.rerun(state.frameKey)))
  if (state.ready && !state.issues.length) return [header, showState({ kind: 'empty', icon: 'checkmark', title: 'No issues' })]
  const rows = state.issues.map(issue => h('li', {}, h('button', {
    'class': 'hst-ref-item',
    'type': 'button',
    'title': 'Highlight in frame',
    'data-focus': `issue-${issue.index}`,
    'onClick': () => model.audits.highlight(state.frameKey, issue.index),
  }, h('span', { 'class': 'hst-ref-chip', 'data-tone': 'warn' }, issue.rule), h('span', { class: 'hst-ref-grow' }, issue.element), h('span', { class: 'hst-ref-muted' }, issue.message))))
  return [header, h('ul', { class: 'hst-ref-list' }, ...rows)]
}

/**
 * Rail pane and home section body.
 * @param model Plugin state.
 * @param context Root context.
 * @param showState Renders the empty state.
 */
function overview(model: ReferenceModel, context: WorkbenchContext, showState: ShowState): Node[] {
  const rows = overviewRows(model)
  if (!rows.length) return [showState({ kind: 'empty', icon: 'view', title: 'No audited frames' })]
  return [h('ul', { class: 'hst-ref-list' }, ...rows.map(row => h('li', {}, h('button', {
    'class': 'hst-ref-item',
    'type': 'button',
    'data-focus': `frame-${row.key}`,
    'onClick': () => void context.navigation.selectStory(row.target),
  }, h('span', { class: 'hst-ref-grow' }, row.name), h('span', { 'class': 'hst-ref-chip', 'data-tone': row.warn ? 'warn' : null }, row.count)))))]
}

/**
 * Settings section and toolbar popover body.
 * @param model Plugin state.
 */
function settings(model: ReferenceModel): Node[] {
  const state = settingsState(model)
  const toggle = h('input', { 'type': 'checkbox', 'checked': state.badges, 'data-focus': 'badges', 'onChange': event => model.preferences.setBadges((event.target as HTMLInputElement).checked) })
  return [
    h('label', { class: 'hst-ref-switch' }, toggle, 'Issue badges'),
    h('div', { class: 'hst-ref-row' }, h('span', { class: 'hst-ref-grow' }, `Annotations: ${state.annotations}`), button('clear', 'Clear', () => model.preferences.clearAnnotations(), !state.annotations)),
    h('div', { class: 'hst-ref-muted' }, `Minimum target size: ${state.minTargetSize} px`),
  ]
}

/**
 * DOM implementation of the four panel views.
 * @param model Plugin state.
 */
export const createDomViews: ReferenceViewFactory = model => ({
  diagnostics: domView(model, (context, showState) => diagnostics(model, context, showState)),
  summary: domView(model, (context: FrameScopedContext) => [h('div', { class: 'hst-ref-row' }, h('span', { class: 'hst-ref-grow' }, diagnosticsState(model, context).status), button('open', 'Open audit', () => context.navigation.openInspectorTab(AUDIT_TAB_ID)))]),
  overview: domView(model, (context, showState) => overview(model, context, showState)),
  settings: domView(model, () => settings(model)),
})
