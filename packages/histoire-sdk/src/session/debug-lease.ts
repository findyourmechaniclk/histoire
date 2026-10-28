import type { HistoireDebugPage, HistoireInspectionOwner } from '@histoire/protocol'
import type { SessionContext } from './context.js'
import type { DiagnosticLease } from './debug.js'
import { HistoireSdkError, sameInspectionOwner, validateInspectionResult } from '@histoire/protocol'
import { request } from './request.js'
import { primaryRuntime } from './state.js'

/** Capture an already mounted runtime and transport; no cleanup rebinds to a successor. */
export function acquireDiagnosticLease(context: SessionContext): DiagnosticLease {
  context.assertConnected()
  if (!context.descriptor?.inspection?.diagnostics?.available || !context.snapshot.inspection?.diagnostics?.available) throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Diagnostics unavailable.')
  const primary = primaryRuntime(context)
  const source = context.snapshot.source!
  const connection = context.connection
  const selected = context.selected()
  const target = { storyId: selected.storyId, variantId: selected.variantId! }
  const owner: HistoireInspectionOwner = context.copy({ sourceId: source.sourceId, epoch: source.epoch, revision: source.revision, runtimeId: context.snapshot.runtime.runtimeId!, target })
  const selectionVersion = context.selectionVersion
  const runtimeVersion = context.runtimeVersion
  /** Check current authority after every async delivery. */
  function current(): boolean {
    const snapshot = context.snapshot
    return snapshot.status === 'ready' && context.connection === connection && context.descriptor?.inspection?.diagnostics?.available === true && snapshot.inspection?.diagnostics?.available === true
      && snapshot.source?.sourceId === owner.sourceId && snapshot.source.epoch === owner.epoch && snapshot.source.revision === owner.revision
      && snapshot.runtime.runtimeId === owner.runtimeId && snapshot.runtime.status === 'ready'
      && snapshot.selection?.storyId === owner.target.storyId && snapshot.selection?.variantId === owner.target.variantId
      && context.primaryId === primary.handle.id && context.mounts.get(primary.handle.id) === primary && primary.active
      && context.selectionVersion === selectionVersion && context.runtimeVersion === runtimeVersion
  }
  return {
    owner,
    current,
    /** Stop may use captured transport after withdrawal, but cannot retarget a new document. */
    async invoke(action, observationId, afterSequence, signal): Promise<HistoireDebugPage> {
      const payload = { action, observationId, target: owner.target, expectedOwner: owner, ...(afterSequence === undefined ? {} : { afterSequence }) }
      let result: unknown
      if (action === 'stop') {
        result = await primary.transport.request('inspection.debug' as any, payload, {
          sessionId: context.sessionId,
          connectionId: primary.transport.id,
          mountId: primary.handle.id,
          sourceId: owner.sourceId,
          epoch: owner.epoch,
          revision: owner.revision,
          runtimeId: owner.runtimeId,
          target: owner.target,
          signal: AbortSignal.timeout(5000),
        })
      }
      else {
        if (!current()) throw new HistoireSdkError('RUNTIME_CHANGED', 'Diagnostic owner changed.')
        result = await request(context, primary.transport, 'inspection.debug' as any, payload, { kind: 'runtime', mountId: primary.handle.id }, signal, owner.target)
        if (!current()) throw new HistoireSdkError('RUNTIME_CHANGED', 'Diagnostic owner changed.')
      }
      const parsed = validateInspectionResult(result)
      if (parsed.mode !== 'live' || parsed.inspection !== 'debug' || !sameInspectionOwner(parsed.owner, owner)) throw new HistoireSdkError('RUNTIME_CHANGED', 'Diagnostic response owner changed.')
      for (const row of parsed.items) {
        if (!row.owner || !sameInspectionOwner(row.owner, owner)) throw new HistoireSdkError('RUNTIME_CHANGED', 'Diagnostic entry owner changed.')
      }
      return context.copy(parsed)
    },
  }
}
