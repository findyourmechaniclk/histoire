// What each panel shows, computed once for every UI variant; views only render these values.
import type { FrameScopedContext } from '@histoire/plugin-kit'
import type { HistoireTarget } from '@histoire/protocol'
import type { ReferenceModel } from './model.js'
import { auditStatus, frameName, issueCount, RULE_LABELS } from './format.js'

/** One issue row. */
export interface IssueRow {
  /** Index in the frame report, used to highlight it. */
  index: number
  /** Rule label. */
  rule: string
  /** Element description. */
  element: string
  /** Detail. */
  message: string
}

/** Inspector tab state. */
export interface DiagnosticsState {
  /** Frame key, for highlight and rerun. */
  frameKey: string
  /** One-line status. */
  status: string
  /** Whether a report arrived. */
  ready: boolean
  /** Issue rows, empty when clean or pending. */
  issues: IssueRow[]
}

/**
 * Inspector tab state for the frame the context is bound to.
 * @param model Plugin state.
 * @param context Frame-scoped context.
 */
export function diagnosticsState(model: ReferenceModel, context: FrameScopedContext): DiagnosticsState {
  const audit = model.audits.get(context.frame.key)
  const issues = audit?.report?.issues.map((issue, index) => ({ index, rule: RULE_LABELS[issue.rule], element: issue.element, message: issue.message })) ?? []
  return { frameKey: context.frame.key, status: auditStatus(audit), ready: Boolean(audit?.report), issues }
}

/** One overview row. */
export interface OverviewRow {
  /** Frame key; unique. */
  key: string
  /** Frame name. */
  name: string
  /** Issue count text, or pending marker. */
  count: string
  /** Whether the frame has issues. */
  warn: boolean
  /** Story and variant to select. */
  target: HistoireTarget
}

/**
 * Rail pane and home section rows: every audited frame.
 * @param model Plugin state.
 */
export function overviewRows(model: ReferenceModel): OverviewRow[] {
  return model.audits.list().map(audit => ({
    key: audit.frame.key,
    name: frameName(audit, model.titles.get(audit.frame.target)),
    count: audit.report ? issueCount(audit.report.issues.length) : '…',
    warn: Boolean(audit.report?.issues.length),
    target: audit.frame.target,
  }))
}

/** Settings panel state. */
export interface SettingsState {
  /** Frame issue badges shown. */
  badges: boolean
  /** Saved annotations. */
  annotations: number
  /** Minimum target size option, read-only here (set in the Histoire config). */
  minTargetSize: number
}

/**
 * Settings panel state.
 * @param model Plugin state.
 */
export function settingsState(model: ReferenceModel): SettingsState {
  return { badges: model.preferences.badges(), annotations: model.preferences.annotations().length, minTargetSize: model.options.minTargetSize }
}

/**
 * Subscribes to everything panel views read: audits, preferences and titles.
 * @param model Plugin state.
 * @param listener Called after any change.
 */
export function subscribeViewState(model: ReferenceModel, listener: () => void): () => void {
  const stops = [model.audits.subscribe(listener), model.preferences.subscribe(listener), model.titles.subscribe(listener)]
  return () => stops.forEach(stop => stop())
}
