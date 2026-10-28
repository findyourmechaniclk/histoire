import type { createDebugBuffer, HistoireInspectionOwner } from '@histoire/protocol'
import type { observeRuntimeDiagnostics } from '@histoire/shared/inspection'

/** Trusted bridge owner includes attachment identity in addition to public source/document identity. */
type DebugBridgeOwner = HistoireInspectionOwner & { sessionId: string, connectionId: string, mountId: string, selectionVersion?: number }

/** Share one document observer while each authorized subscription owns its own timeline. */
export function createRuntimeDebug(target: Window & { console: Console }, createBuffer: typeof createDebugBuffer, observe: typeof observeRuntimeDiagnostics) {
  const observations = new Map<string, { owner: DebugBridgeOwner, buffer: ReturnType<typeof createDebugBuffer> }>()
  let stop: (() => void) | undefined
  let changing = false
  let closed = false
  /** Compare captured identities without relying on object property ordering. */
  function sameOwner(a: HistoireInspectionOwner, b: HistoireInspectionOwner): boolean {
    return a.sourceId === b.sourceId && a.epoch === b.epoch && a.revision === b.revision && a.runtimeId === b.runtimeId && a.target.storyId === b.target.storyId && a.target.variantId === b.target.variantId
  }
  /** A peer cannot use another peer's observation even when both inspect the same document. */
  function sameBridge(a: DebugBridgeOwner, b: DebugBridgeOwner): boolean {
    return sameOwner(a, b) && a.sessionId === b.sessionId && a.connectionId === b.connectionId && a.mountId === b.mountId && a.selectionVersion === b.selectionVersion
  }
  /** Install one observer, including across synchronous reentrant starts and stops. */
  function reconcile(): void {
    if (changing) return
    changing = true
    try {
      while (Boolean(stop) !== Boolean(observations.size)) {
        if (stop) {
          const previous = stop
          stop = undefined
          previous()
        }
        else {
          stop = observe(target, (entry) => {
            for (const item of observations.values()) {
              const { sourceId, epoch, revision, runtimeId, target } = item.owner
              item.buffer.add({ ...entry, owner: { sourceId, epoch, revision, runtimeId, target } })
            }
          }, () => { for (const item of observations.values()) item.buffer.drop() })
        }
      }
    }
    finally { changing = false }
  }
  return {
    /** Read or stop only the caller's captured observation and document owner. */
    run(input: { action: 'start' | 'read' | 'stop', observationId: string, expectedOwner: HistoireInspectionOwner, afterSequence?: number }, bridgeOwner: DebugBridgeOwner) {
      if (closed || !bridgeOwner || !input.expectedOwner || !sameOwner(input.expectedOwner, bridgeOwner)) throw Object.assign(new Error('Diagnostic observation is closed'), { code: 'RUNTIME_CHANGED' })
      let observation = observations.get(input.observationId)
      if (input.action === 'start' && !observation) {
        if (observations.size >= 4) throw Object.assign(new Error('Too many diagnostic observations'), { code: 'RATE_LIMITED' })
        observation = { owner: structuredClone(bridgeOwner), buffer: createBuffer() }
        observations.set(input.observationId, observation)
        try {
          reconcile()
        }
        catch (error) {
          if (observations.get(input.observationId) === observation) observations.delete(input.observationId)
          throw error
        }
      }
      if (!observation || !sameBridge(observation.owner, bridgeOwner)) throw Object.assign(new Error('Diagnostic observation is closed'), { code: 'RUNTIME_CHANGED' })
      const page = observation.buffer.read({ afterSequence: input.afterSequence })
      if (input.action === 'stop') {
        observations.delete(input.observationId)
        reconcile()
      }
      return page
    },
    /** Revoke observations before selection or policy replacement. */
    reset(): void {
      observations.clear()
      reconcile()
    },
    /** Release document instrumentation and histories on retirement. */
    close(): void {
      closed = true
      observations.clear()
      reconcile()
    },
  }
}
