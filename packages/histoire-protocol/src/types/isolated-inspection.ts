import type { HistoireDomProjection, HistoireVariantProjection } from './inspection.js'

/** Shared isolated observation identity, independent of MCP retention. */
export interface HistoireIsolatedInspectionBase {
  /** Exact registered story. */
  storyId: string
  /** Exact mounted variant. */
  variantId: string
  /** CSS viewport used for the fresh document. */
  viewport: { width: number, height: number }
  /** Work or byte limits omitted content. */
  truncated: boolean
}
/** Bounded sanitized browser event. */
export interface HistoireRuntimeDiagnostic {
  /** Observed event category. */
  kind: 'console' | 'page-error' | 'request-failed' | 'http-error'
  /** Console severity. */
  level?: string
  /** Sanitized text, without raw arguments. */
  message: string
  /** HTTP URL without credentials, query or fragment. */
  url?: string
  /** HTTP response status. */
  status?: number
}
/** Fresh browser observations with stable legacy discriminator shapes. */
export type HistoireIsolatedInspection = HistoireIsolatedInspectionBase & (
  | HistoireVariantProjection & { inspection: 'variant' }
  | HistoireDomProjection & { inspection: 'dom' }
  | { inspection: 'accessibility', matched: boolean, snapshot: string, totalCharacters: number }
  | { inspection: 'diagnostics', previewReady: boolean, readinessError?: string, entries: HistoireRuntimeDiagnostic[], droppedCount: number }
)
/** Finite isolated service operations. ARIA is distinct from axe. */
export type HistoireIsolatedInspectionKind = 'inspect-variant' | 'inspect-dom' | 'inspect-accessibility' | 'runtime-diagnostics'
/** Normalized bounded service arguments; public adapters validate before admission. */
export interface HistoireIsolatedInspectionInput {
  /** Exact registered story. */
  storyId: string
  /** Exact variant. */
  variantId: string
  /** CSS width. */
  width: number
  /** CSS height. */
  height: number
  /** Root CSS query. */
  selector?: string
  /** Retained DOM nodes. */
  maxNodes?: number
  /** DOM traversal depth. */
  maxDepth?: number
  /** Retained ARIA characters. */
  maxCharacters?: number
  /** Additional diagnostic observation milliseconds. */
  observationMs?: number
}
