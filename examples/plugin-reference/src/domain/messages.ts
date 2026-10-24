// Plugin channel vocabulary shared by the frame and workbench modules.

/** Message types exchanged on the reference plugin channel. */
export const REFERENCE_MESSAGES = Object.freeze({
  /** Frame to workbench: latest `AuditReport`. */
  report: 'report',
  /** Workbench to frame: audit now and post a report, even when unchanged. */
  audit: 'audit',
  /** Workbench to frame: outline the element of one issue (`{ index }`). */
  highlight: 'highlight',
})

/** Payload of {@link REFERENCE_MESSAGES.highlight}. */
// eslint-disable-next-line ts/consistent-type-definitions -- JSON payload: an interface lacks the index signature `HistoireJsonValue` needs
export type HighlightMessage = {
  /** Index into the last report's issues. */
  index: number
}
