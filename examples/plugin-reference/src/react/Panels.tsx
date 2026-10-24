import type { WorkbenchContext } from '@histoire/plugin-kit'
import type { ReferenceModel } from '../domain/model.js'
import { overviewRows, settingsState } from '../domain/view-state.js'
import { useModel } from './use-model.js'

/** Props of the root-context views. */
interface RootViewProps {
  /** Root context. */
  context: WorkbenchContext
  /** Plugin state. */
  model: ReferenceModel
}

/**
 * Rail pane and home section: every audited frame; clicking one selects its variant.
 * @param props View props.
 * @param props.context Root context.
 * @param props.model Plugin state.
 */
export function Overview({ context, model }: RootViewProps) {
  useModel(model)
  const rows = overviewRows(model)
  if (!rows.length) return <div className="hst-ref-panel"><div className="hst-ref-empty">No audited frames</div></div>
  return (
    <div className="hst-ref-panel">
      <ul className="hst-ref-list">
        {rows.map(row => (
          <li key={row.key}>
            <button type="button" className="hst-ref-item" onClick={() => void context.navigation.selectStory(row.target)}>
              <span className="hst-ref-grow">{row.name}</span>
              <span className="hst-ref-chip" data-tone={row.warn ? 'warn' : undefined}>{row.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Settings section and toolbar popover: per-user preferences.
 * @param props View props.
 * @param props.model Plugin state.
 */
export function Settings({ model }: RootViewProps) {
  useModel(model)
  const state = settingsState(model)
  return (
    <div className="hst-ref-panel">
      <label className="hst-ref-switch">
        <input type="checkbox" checked={state.badges} onChange={event => model.preferences.setBadges(event.target.checked)} />
        Issue badges
      </label>
      <div className="hst-ref-row">
        <span className="hst-ref-grow">
          Annotations:
          {' '}
          {state.annotations}
        </span>
        <button type="button" className="hst-ref-button" disabled={!state.annotations} onClick={() => model.preferences.clearAnnotations()}>Clear</button>
      </div>
      <div className="hst-ref-muted">
        Minimum target size:
        {' '}
        {state.minTargetSize}
        {' '}
        px
      </div>
    </div>
  )
}
