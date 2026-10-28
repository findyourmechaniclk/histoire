import type { HistoireInspectionMetadata } from './inspection.js'

/** Bounded axe finding without raw HTML. */
export interface HistoireAccessibilityFinding {
  /** Axe rule identity. */
  id: string
  /** Axe severity when available. */
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null
  /** Human-readable rule title. */
  help: string
  /** HTTP(S) rule documentation. */
  helpUrl: string
  /** Affected elements within selected variant. */
  nodes: {
    /** Ordered axe selector path. */
    selectors: string[]
    /** Accessible name when available from the audit engine. */
    accessibleName?: string
    /** Bounded diagnostic text. */
    failureSummary?: string
  }[]
}
/** Automated findings, not accessibility compliance certification. */
export interface HistoireAccessibilityInspection extends HistoireInspectionMetadata {
  /** Result discriminator. */
  inspection: 'accessibility'
  /** Requested root existed; no fallback to shell. */
  matched: boolean
  /** Scanner identity. */
  engine: 'axe-core'
  /** Actual loaded scanner version. */
  engineVersion: string
  /** Failed checks. */
  violations: HistoireAccessibilityFinding[]
  /** Checks needing human review. */
  incomplete: HistoireAccessibilityFinding[]
  /** Passed rule count. */
  passesCount: number
  /** Inapplicable rule count. */
  inapplicableCount: number
  /** Findings omitted by bounds. */
  droppedCount: number
}
