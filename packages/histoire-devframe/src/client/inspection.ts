import type { HistoireInspectionOwner } from '@histoire/protocol'
import type { HistoireSession } from '@histoire/sdk'
import { measureWireValue, sameInspectionOwner, validateBridgeResult, validateInspectionInput, validateInspectionOwner, validateInspectionResult } from '@histoire/protocol'

/** Dispatch finite reads against the caller-owned mounted session. */
export function createInspectionDispatcher(session: Pick<HistoireSession, 'inspect'>, expected: HistoireInspectionOwner) {
  const owner = structuredClone(validateInspectionOwner(expected))
  return async (value: unknown, signal: AbortSignal) => {
    measureWireValue(value, { maxBytes: 16 * 1024, maxDepth: 32 })
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid inspection request')
    const { kind, ...options } = value as Record<string, unknown>
    if (typeof kind !== 'string' || !['variant', 'dom', 'components', 'component', 'componentForElement', 'accessibility', 'highlight'].includes(kind)) throw new Error('Invalid inspection request')
    validateInspectionInput(kind, options)
    const captured = validateInspectionOwner(options.expectedOwner)
    if (!sameInspectionOwner(captured, owner) || !options.target || (options.target as HistoireInspectionOwner['target']).storyId !== owner.target.storyId || (options.target as HistoireInspectionOwner['target']).variantId !== owner.target.variantId) throw new Error('Inspection owner changed')
    signal.throwIfAborted()
    const method = session.inspect[kind === 'highlight' ? 'highlightLease' : kind as 'variant' | 'dom' | 'components' | 'component' | 'componentForElement' | 'accessibility'] as (input: Record<string, unknown>) => Promise<unknown>
    const result = await method({ ...options, signal })
    if (kind === 'highlight') {
      validateBridgeResult('inspection.highlightLease', result)
      const acknowledgement = result as { owner: HistoireInspectionOwner, observedAt: string, leaseId: string }
      if (!sameInspectionOwner(acknowledgement.owner, owner)) throw new Error('Inspection owner changed')
      return structuredClone(acknowledgement)
    }
    signal.throwIfAborted()
    const verified = validateInspectionResult(result)
    if (verified.mode !== 'live' || verified.inspection !== kind || !sameInspectionOwner(verified.owner, owner)) throw new Error('Inspection owner changed')
    return structuredClone(verified)
  }
}
