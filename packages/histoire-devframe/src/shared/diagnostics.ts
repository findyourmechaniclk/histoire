import type { HistoireInspectionOwner } from '@histoire/protocol'
import { assertInspectionJson, measureWireValue, validateInspectionOwner, validateInspectionTarget } from '@histoire/protocol'

/** Bounded diagnostic cursor tied to an exact mounted owner. */
export function parseDiagnosticRequest(value: unknown) {
  measureWireValue(value, { maxBytes: 16 * 1024, maxDepth: 32 })
  assertInspectionJson(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid diagnostic request')
  const input = value as Record<string, unknown>
  if (Object.keys(input).some(key => !['expectedOwner', 'target', 'afterSequence', 'limit'].includes(key))) throw new Error('Invalid diagnostic request')
  const expectedOwner = validateInspectionOwner(input.expectedOwner)
  const target = validateInspectionTarget(input.target)
  if (target.storyId !== expectedOwner.target.storyId || target.variantId !== expectedOwner.target.variantId) throw new Error('Invalid diagnostic request')
  if (input.afterSequence !== undefined && (!Number.isSafeInteger(input.afterSequence) || (input.afterSequence as number) < 0)) throw new Error('Invalid diagnostic cursor')
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || (input.limit as number) < 1 || (input.limit as number) > 100)) throw new Error('Invalid diagnostic limit')
  return input as { expectedOwner: HistoireInspectionOwner, target: HistoireInspectionOwner['target'], afterSequence?: number, limit?: number }
}
