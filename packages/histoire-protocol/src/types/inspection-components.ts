import type { HistoireJsonValue } from './common.js'
import type { HistoireInspectionMetadata } from './inspection.js'

/** Known gaps in framework ownership coverage, independent of output truncation. */
export type HistoireComponentLimitation = 'fragment' | 'slot' | 'teleport' | 'async' | 'keep-alive' | 'framework-metadata' | 'source'

/** Declares whether framework ownership was fully established for the inspected scope. */
export interface HistoireComponentCoverage {
  /** Completeness of the provider's ownership mapping. */
  coverage: 'complete' | 'partial'
  /** Bounded reasons for incomplete ownership evidence. */
  limitations: HistoireComponentLimitation[]
}

/** Verified project-relative location; never grants editor authority. */
export interface HistoireInspectionSource {
  /** Path contained in registered project. */
  relativePath: string
  /** One-based source line when known. */
  line?: number
  /** One-based source column when known. */
  column?: number
}
/** Detached framework instance identity, never a raw Vue instance. */
export interface HistoireInspectedComponent {
  /** Opaque document-scoped identity. */
  id: string
  /** Parent identity in this tree; null at root. */
  parentId: string | null
  /** Human-readable component name. */
  name: string
  /** Framework provider name. */
  framework: string
  /** Verified location when available. */
  source?: HistoireInspectionSource
}
/** Bounded active component tree; omitted branches contribute to a lower bound. */
export interface HistoireComponentTreeInspection extends HistoireInspectionMetadata, HistoireComponentCoverage {
  /** Result discriminator. */
  inspection: 'components'
  /** Retained parent-before-child nodes. */
  nodes: HistoireInspectedComponent[]
  /** At least this many component nodes or unexplored branches were omitted. */
  omittedCount: number
}
/** Safe details for one exact instance; getters never evaluated. */
export interface HistoireComponentInspection extends HistoireInspectionMetadata, HistoireComponentCoverage {
  /** Result discriminator. */
  inspection: 'component'
  /** Inspected instance. */
  node: HistoireInspectedComponent
  /** Safely projected props. */
  props: Record<string, HistoireJsonValue>
  /** Opt-in safe setup/data values when available. */
  state?: Record<string, HistoireJsonValue>
  /** Associated elements in owning document. */
  selectors: string[]
  /** Unsupported or clipped values. */
  omittedValues: number
}

/** A selector's nearest proven component owner inside the captured story root. */
export interface HistoireComponentElementInspection extends HistoireInspectionMetadata, HistoireComponentCoverage {
  /** Result discriminator. */
  inspection: 'componentForElement'
  /** Whether the selector matched within the story root. */
  matched: boolean
  /** Proven component owner, or null when unavailable. */
  node: HistoireInspectedComponent | null
  /** Why a matched element has no proven owner. */
  unavailableReason?: 'owner-unavailable' | 'outside-owned-root'
}
