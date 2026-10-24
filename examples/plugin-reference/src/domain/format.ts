import type { FrameAudit } from './audit-store.js'
// Display text shared by every UI variant, so copy stays identical across frameworks.
import type { AuditRule } from './audit.js'

/** Short rule names. */
export const RULE_LABELS: Readonly<Record<AuditRule, string>> = Object.freeze({
  'missing-alt': 'Missing alt',
  'unnamed-control': 'Unnamed control',
  'small-target': 'Small target',
})

/**
 * `1 issue`, `3 issues`.
 * @param count Issue count.
 */
export function issueCount(count: number): string {
  return `${count} ${count === 1 ? 'issue' : 'issues'}`
}

/**
 * One-line status of a frame audit.
 * @param audit Frame audit, if the frame is tracked.
 */
export function auditStatus(audit: FrameAudit | undefined): string {
  if (!audit?.report) return 'Waiting for audit'
  return `${issueCount(audit.report.issues.length)} · ${audit.report.nodes} elements`
}

/**
 * Readable frame name: catalog title, or ids until the catalog loaded.
 * @param audit Frame audit.
 * @param title Catalog title, if known.
 */
export function frameName(audit: FrameAudit, title: string | undefined): string {
  return title ?? `${audit.frame.target.storyId} › ${audit.frame.target.variantId ?? 'story'}`
}
