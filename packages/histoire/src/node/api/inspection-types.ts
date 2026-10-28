import type { HistoireAccessibilityInspection, HistoireIsolatedInspection, HistoireReadonly } from '@histoire/protocol'
import type { HistoireCaptureOptions } from './types.js'

/** Explicit source for a fresh isolated observation; no live attachment is consulted. */
export interface HistoireProjectInspectionOptions extends HistoireCaptureOptions {
  /** Ready source to use, without fallback. */
  source: 'dev' | 'preview'
  /** Reject a different completed publication before browser admission. */
  expectedRevision?: string
}
/** Node result adds source ownership without MCP operation/resource identities. */
export type HistoireProjectInspectionResult = HistoireIsolatedInspection & {
  /** Fresh independent browser execution. */
  mode: 'isolated'
  /** Captured source publication. */
  source: { sourceId: string, epoch: string, revision: string }
  /** UTC observation completion. */
  observedAt: string
  /** Duration including source lane wait. */
  durationMs: number
}
/** Fresh story-scoped axe results, separate from the existing ARIA snapshot. */
export type HistoireProjectAccessibilityResult = Omit<HistoireAccessibilityInspection, 'mode' | 'owner'> & {
  /** Fresh independent browser execution. */
  mode: 'isolated'
  /** Captured source publication. */
  source: HistoireProjectInspectionResult['source']
  /** Captured target and viewport. */
  storyId: string
  variantId: string
  viewport: { width: number, height: number }
}
/** Fresh observation services; Playwright ARIA does not imply axe compliance. */
export interface HistoireProjectInspection {
  /** Getter-safe rendered state and prop definitions. */
  variant: (options: HistoireProjectInspectionOptions) => Promise<HistoireReadonly<HistoireProjectInspectionResult & { inspection: 'variant' }>>
  /** Bounded rendered element subtree. */
  dom: (options: HistoireProjectInspectionOptions & { selector?: string, maxNodes?: number, maxDepth?: number }) => Promise<HistoireReadonly<HistoireProjectInspectionResult & { inspection: 'dom' }>>
  /** Playwright accessibility structure, independent of axe audits. */
  aria: (options: HistoireProjectInspectionOptions & { selector?: string, maxCharacters?: number }) => Promise<HistoireReadonly<HistoireProjectInspectionResult & { inspection: 'accessibility' }>>
  /** Optional story-scoped axe scan; not an accessibility compliance certification. */
  accessibility: (options: HistoireProjectInspectionOptions & { selector?: string }) => Promise<HistoireReadonly<HistoireProjectAccessibilityResult>>
  /** Fresh mount console, page and network evidence. */
  diagnostics: (options: HistoireProjectInspectionOptions & { observationMs?: number }) => Promise<HistoireReadonly<HistoireProjectInspectionResult & { inspection: 'diagnostics' }>>
}
