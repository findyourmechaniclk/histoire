import type { HistoireInspection, HistoireInspectionOptions, HistoireInspectionOwner } from '@histoire/protocol'
import type { SessionContext } from './context.js'
import { HISTOIRE_INSPECTION_OPERATION_CAPABILITIES, HistoireSdkError, sameInspectionOwner, validateInspectionInput, validateInspectionResult, validateInspectionTarget, wireRecord } from '@histoire/protocol'
import { observeOperation } from './ownership.js'
import { request } from './request.js'
import { primaryRuntime } from './state.js'
import { assertVariant } from './variant.js'

/** Finite reads capture authority before scheduling transport work. */
export function createSessionInspection(context: SessionContext): HistoireInspection {
  let pending = 0
  let pendingCleanup = 0
  async function read(kind: 'variant' | 'dom' | 'components' | 'component' | 'componentForElement' | 'highlight' | 'highlightLease' | 'highlightClear' | 'pick' | 'accessibility', options: HistoireInspectionOptions = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new HistoireSdkError('INVALID_ARGUMENT', 'Inspection options must be an object.')
    let descriptors: PropertyDescriptorMap
    try {
      wireRecord(options)
      descriptors = Object.getOwnPropertyDescriptors(options)
      if (Object.values(descriptors).some(descriptor => !('value' in descriptor))) throw new Error('Accessor')
    }
    catch { throw new HistoireSdkError('INVALID_ARGUMENT', 'Inspection options must be a plain object without accessors.') }
    const signal = descriptors.signal?.value as AbortSignal | undefined
    const input = Object.fromEntries(Object.entries(descriptors).filter(([key, descriptor]) => key !== 'signal' && descriptor.enumerable).map(([key, descriptor]) => [key, descriptor.value]))
    if (signal !== undefined && !(signal instanceof AbortSignal)) throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid cancellation signal.')
    validateInspectionInput(kind, input)
    const target = input.target ?? context.selected()
    validateInspectionTarget(target)
    const capturedTarget = context.copy(target) as HistoireInspectionOwner['target']
    assertVariant(context.story(capturedTarget.storyId), capturedTarget.variantId)
    const primary = primaryRuntime(context)
    const source = context.snapshot.source!
    const owner: HistoireInspectionOwner = { sourceId: source.sourceId, epoch: source.epoch, revision: source.revision, runtimeId: context.snapshot.runtime.runtimeId!, target: capturedTarget }
    const payload = context.copy({ ...input, target: capturedTarget })
    if (input.expectedOwner && !sameInspectionOwner(input.expectedOwner as HistoireInspectionOwner, owner)) throw new HistoireSdkError('RUNTIME_CHANGED', 'Inspection owner changed.')
    const assertCapability = () => {
      const capability = HISTOIRE_INSPECTION_OPERATION_CAPABILITIES[kind]
      if (!context.descriptor?.inspection?.[capability]?.available || !context.snapshot.inspection?.[capability]?.available || ((kind === 'highlight' || kind === 'highlightLease') && input.componentId !== undefined && (!context.descriptor?.inspection?.highlight?.available || !context.snapshot.inspection?.highlight?.available || !context.descriptor?.inspection?.componentHighlight?.available || !context.snapshot.inspection?.componentHighlight?.available))) throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Inspection is unavailable.')
    }
    assertCapability()
    const cleanup = kind === 'highlightClear'
    if ((cleanup ? pendingCleanup : pending) >= 16) throw new HistoireSdkError('RATE_LIMITED', 'Too many inspection requests.')
    if (cleanup) pendingCleanup++
    else pending++
    try {
      let result: unknown
      try {
        result = await request(context, primary.transport, `inspection.${kind}`, payload, { kind: input.target ? 'inspection' : 'runtime', mountId: primary.handle.id }, signal, capturedTarget)
      }
      catch (error) {
        if (error instanceof HistoireSdkError && ['RUNTIME_CHANGED', 'STALE_REVISION', 'DISPOSED', 'NOT_CONNECTED', 'CANCELLED'].includes(error.code)) throw error
        assertCapability()
        throw error
      }
      assertCapability()
      const action = ['highlight', 'highlightLease', 'highlightClear', 'pick'].includes(kind)
      const validated = action ? result as { owner: HistoireInspectionOwner } : validateInspectionResult(result)
      if (!sameInspectionOwner(validated.owner, owner) || (!action && ((validated as any).mode !== 'live' || (validated as any).inspection !== kind))) throw new HistoireSdkError('RUNTIME_CHANGED', 'Inspection response owner changed.')
      return context.copy(validated) as any
    }
    finally {
      if (cleanup) pendingCleanup--
      else pending--
    }
  }
  return {
    variant: options => observeOperation(read('variant', options)),
    dom: options => observeOperation(read('dom', options)),
    components: options => observeOperation(read('components', options)),
    component: options => observeOperation(read('component', options)),
    componentForElement: options => observeOperation(read('componentForElement', options)),
    accessibility: options => observeOperation(read('accessibility', options)),
    highlight: options => observeOperation(read('highlight', options)),
    highlightLease: options => observeOperation(read('highlightLease', options)),
    clearHighlight: options => observeOperation(read('highlightClear', options)),
    pick: options => observeOperation(read('pick', options)),
  }
}
