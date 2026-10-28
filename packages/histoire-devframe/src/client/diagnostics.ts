import type { HistoireInspectionOwner } from '@histoire/protocol'
import type { HistoireSession } from '@histoire/sdk'
import { sameInspectionOwner, validateInspectionResult } from '@histoire/protocol'
import { parseDiagnosticRequest } from '../shared/diagnostics.js'

/** Explicitly start one scoped SDK diagnostic observation for an attachment. */
export function createDiagnosticReader(session: Pick<HistoireSession, 'debug'>, owner: HistoireInspectionOwner) {
  const observation = session.debug.subscribe(() => {})
  let active = true
  const closed = observation.closed.then(() => {
    active = false
  }, () => {
    active = false
  })
  return {
    /** Resolves when observation ends, including a failed poll. */
    closed,
    /** Resolves only when the runtime accepts the observation. */
    ready: observation.ready,
    /** Read bounded, already-observed entries attributed to the captured owner. */
    read(value: unknown) {
      if (!active) throw new Error('Diagnostic observation unavailable')
      const input = parseDiagnosticRequest(value)
      if (!sameInspectionOwner(input.expectedOwner, owner)) throw new Error('Diagnostic owner changed')
      const page = session.debug.getSnapshot({ afterSequence: input.afterSequence, limit: input.limit })
      const items = page.items.filter(item => item.owner && sameInspectionOwner(item.owner, owner))
      return validateInspectionResult({ mode: 'live', inspection: 'debug', owner, observedAt: new Date().toISOString(), durationMs: 0, truncated: page.gap || page.droppedCount > 0, ...page, items })
    },
    /** Release the caller-owned observation without closing the SDK session. */
    dispose: observation.unsubscribe,
  }
}
