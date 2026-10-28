import type { HistoireJsonValue } from './common.js'
import type { HistoireInspectionOwner } from './inspection.js'
import type { HistoireReadonly } from './readonly.js'

/** Bounded text evidence; correlation is never inferred for unrelated console events. */
export interface HistoireDebugEntry {
  /** Monotonic sequence within this retained timeline. */
  sequence: number
  /** UTC epoch milliseconds. */
  timestamp: number
  /** Browser monotonic clock; never joined to server clock. */
  monotonicTimeMs: number
  /** Exact SDK request when known. */
  requestId?: string
  /** Exact operation when known. */
  operationId?: string
  /** Attributed request outcome. */
  outcome?: string
  /** Bounded safe structured details; raw payloads excluded. */
  details?: HistoireJsonValue
  /** Event origin/category. */
  kind: 'console' | 'page-error' | 'unhandled-rejection' | 'sdk-request' | 'component-event' | 'state-patch' | 'lifecycle'
  /** Bounded text without raw arguments or stack. */
  message: string
  /** Console severity or request outcome. */
  level?: string
  /** Source/document and subscription target, not proof of event causality. */
  owner?: HistoireInspectionOwner
  /** Explicit caller correlation label. */
  correlationId?: string
}
/** Retained page with monotonic continuation and visible loss. */
export interface HistoireDebugPage {
  /** Complete entries within serialized budget. */
  items: HistoireDebugEntry[]
  /** Last retained sequence in this page, or supplied cursor. */
  nextSequence: number
  /** Entries lost to bounds or explicit clear within this timeline. */
  droppedCount: number
  /** Earliest retained sequence, or next sequence when empty. */
  oldestSequence: number
  /** Requested cursor predates retained history. */
  gap: boolean
}
/**
 * Explicit observation lifetime; replacement requires a new subscription.
 * Console and error observations span the mounted document, not only the selected target.
 * Common credentials are redacted, but arbitrary user text can remain sensitive.
 */
export interface HistoireDebug {
  /** Read locally retained history without starting instrumentation. */
  getSnapshot: (options?: { afterSequence?: number, limit?: number }) => HistoireReadonly<HistoireDebugPage>
  /** Start authorized observation; closed resolves on unsubscribe and rejects on observation loss. */
  subscribe: (listener: (page: HistoireReadonly<HistoireDebugPage>) => void) => { ready: Promise<void>, closed: Promise<void>, unsubscribe: () => Promise<void> }
  /** Clear local history only; sequence identities never restart. */
  clear: () => void
}
