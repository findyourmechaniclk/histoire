import type { FrameScopedContext } from '@histoire/plugin-kit'
import type { ReferenceModel } from '../domain/model.js'
import { diagnosticsState } from '../domain/view-state.js'
import { AUDIT_TAB_ID } from '../workbench/views.js'
import { useModel } from './use-model.js'

/** Props of the frame-scoped views. */
interface FrameViewProps {
  /** Frame-scoped context of the selected frame. */
  context: FrameScopedContext
  /** Plugin state. */
  model: ReferenceModel
}

/**
 * Inspector tab: issues of the selected frame; clicking one highlights it inside the frame.
 * @param props View props.
 * @param props.context Frame-scoped context.
 * @param props.model Plugin state.
 */
export function Diagnostics({ context, model }: FrameViewProps) {
  useModel(model)
  const state = diagnosticsState(model, context)
  return (
    <div className="hst-ref-panel">
      <div className="hst-ref-row">
        <span className="hst-ref-grow">{state.status}</span>
        <button type="button" className="hst-ref-button" onClick={() => model.audits.rerun(state.frameKey)}>Run again</button>
      </div>
      {state.ready && !state.issues.length
        ? <div className="hst-ref-empty">No issues</div>
        : (
            <ul className="hst-ref-list">
              {state.issues.map(issue => (
                <li key={issue.index}>
                  <button type="button" className="hst-ref-item" title="Highlight in frame" onClick={() => model.audits.highlight(state.frameKey, issue.index)}>
                    <span className="hst-ref-chip" data-tone="warn">{issue.rule}</span>
                    <span className="hst-ref-grow">{issue.element}</span>
                    <span className="hst-ref-muted">{issue.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
    </div>
  )
}

/**
 * Inspector section: one-line status with a shortcut to the tab.
 * @param props View props.
 * @param props.context Frame-scoped context.
 * @param props.model Plugin state.
 */
export function Summary({ context, model }: FrameViewProps) {
  useModel(model)
  return (
    <div className="hst-ref-panel" data-flush="">
      <div className="hst-ref-row">
        <span className="hst-ref-grow">{diagnosticsState(model, context).status}</span>
        <button type="button" className="hst-ref-button" onClick={() => context.navigation.openInspectorTab(AUDIT_TAB_ID)}>Open audit</button>
      </div>
    </div>
  )
}
