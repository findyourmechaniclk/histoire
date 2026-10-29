import type { PluginChannel } from '@histoire/plugin-kit'
import type { HistoireJsonValue } from '@histoire/protocol'
import type { normalizeAccessibility } from '@histoire/shared/accessibility'

/** Bounded UI report; raw axe nodes never cross channel. */
export type AuditReport = ReturnType<typeof normalizeAccessibility> & {
  /** Total violating rules before display bounds. */
  violationsCount: number
  /** Total rules needing review before display bounds. */
  incompleteCount: number
}

/** Frame control message scoped to one mounted inspector visit. */
export interface AuditCommand {
  /** Inspector visit identity. */
  visit: string
  /** Whether live changes trigger scans. */
  autoRun?: boolean
  /** Report owning highlight target. */
  reportId?: number
  /** Opaque node key, resolved only from frame-owned references. */
  node?: string
}

/** Correlated frame status. */
export interface AuditUpdate {
  /** Inspector visit identity. */
  visit: string
  /** Scan sequence within actor. */
  request: number
  /** Successful report identity. */
  reportId?: number
  /** Latest bounded result. */
  report?: AuditReport
  /** Pending scan. */
  running?: boolean
  /** Prior result no longer reflects current DOM. */
  stale?: boolean
  /** Actionable failure. */
  error?: string
  /** Compact highlight feedback. */
  feedback?: string
}

/** Post owned JSON DTO through bounded plugin transport. */
export function send(channel: PluginChannel, type: string, data: AuditCommand | AuditUpdate): Promise<void> {
  return channel.post(type, data as unknown as HistoireJsonValue)
}

/** Read command shape without trusting arbitrary host messages. */
export function command(value: unknown): AuditCommand | undefined {
  if (!value || typeof value !== 'object') return
  const data = value as AuditCommand
  return typeof data.visit === 'string' && data.visit.length > 0 && data.visit.length < 128 ? data : undefined
}
