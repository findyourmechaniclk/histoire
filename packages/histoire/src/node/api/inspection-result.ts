import type { HistoireIsolatedInspection } from '@histoire/protocol'
import type { HistoireProjectInspectionResult } from './inspection-types.js'
import { measureWireValue } from '@histoire/protocol'
import { boundInspectionResult } from '../runtime/inspection/result.js'

/** Add source metadata on a detached copy, preserving the original retained result. */
export function createProjectInspectionResult(output: HistoireIsolatedInspection, source: HistoireProjectInspectionResult['source'], durationMs: number): HistoireProjectInspectionResult {
  const result: HistoireProjectInspectionResult = { ...structuredClone(output), mode: 'isolated', source: { ...source }, observedAt: new Date().toISOString(), durationMs }
  boundInspectionResult(result)
  measureWireValue(result, { maxBytes: 60 * 1024, maxDepth: 32 })
  return result
}
