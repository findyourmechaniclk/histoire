import type { HistoireRequestCapture } from '@histoire/sdk/internal'
import { HistoireSdkError, RUNTIME_REQUEST } from '@histoire/protocol'

/** Cancel only the originating bridge request and its captured runtime owner. */
export function cancelRuntimeInspection(post: (message: Record<string, unknown>) => void, capture: HistoireRequestCapture, requestId: string) {
  const inspectionOwner = { sessionId: capture.sessionId, connectionId: capture.connectionId, mountId: capture.mountId, sourceId: capture.sourceId, epoch: capture.epoch, revision: capture.revision, runtimeId: capture.runtimeId, target: capture.target, selectionVersion: capture.selectionVersion }
  post({ type: RUNTIME_REQUEST, command: 'inspection.cancel', requestId, documentId: capture.runtimeId, ...capture.target, inspectionOwner })
}

/** Pending sandbox calls belong to one document, never surviving iframe navigation. */
export function createRuntimeRequests(post: (message: Record<string, unknown>) => void, timeoutMs: number) {
  let next = 0
  const pending = new Map<string, { resolve: (value: any) => void, reject: (error: unknown) => void, clear: () => void, cancel: (error: unknown) => void, target?: HistoireRequestCapture['target'], inspectionOwner?: Record<string, unknown> }>()
  return {
    /** Existing sandbox protocol receives exact tuple/document instead of parsed variant keys. */
    request(type: string, payload: Record<string, unknown>, capture: HistoireRequestCapture): Promise<any> {
      const requestId = capture.requestId ?? `runtime:${++next}`
      const inspection = String(payload.command ?? '').startsWith('inspection.')
      const inspectionOwner = inspection ? { sessionId: capture.sessionId, connectionId: capture.connectionId, mountId: capture.mountId, sourceId: capture.sourceId, epoch: capture.epoch, revision: capture.revision, runtimeId: capture.runtimeId, target: capture.target, selectionVersion: capture.selectionVersion } : undefined
      return new Promise((resolve, reject) => {
        const abort = () => finish(new HistoireSdkError('CANCELLED', 'Runtime request cancelled'))
        const timer = setTimeout(() => finish(new HistoireSdkError('TIMEOUT', 'Runtime request timed out')), timeoutMs)
        /** Stop listeners before settling or rejecting captured work. */
        function finish(error?: unknown) {
          const entry = pending.get(requestId)
          if (!entry) return
          pending.delete(requestId)
          entry.clear()
          if (error && inspection) cancelRuntimeInspection(post, capture, requestId)
          if (error) reject(error)
        }
        pending.set(requestId, { resolve, reject, cancel: finish, target: capture.target, inspectionOwner, clear: () => {
          clearTimeout(timer)
          capture.signal.removeEventListener('abort', abort)
        } })
        capture.signal.addEventListener('abort', abort, { once: true })
        if (capture.signal.aborted) abort()
        else post({ type, ...payload, requestId, runId: requestId, documentId: capture.runtimeId, ...capture.target, ...(inspection ? { inspectionOwner } : {}) })
      })
    },
    /** Frame/document/tuple validation happens before this correlated settlement. */
    receive(message: Record<string, any>) {
      const id = message.requestId ?? message.runId
      const entry = pending.get(id)
      if (!entry) return
      if (message.storyId !== entry.target?.storyId || message.variantId !== entry.target?.variantId) return
      if (entry.inspectionOwner && JSON.stringify(entry.inspectionOwner) !== JSON.stringify(message.inspectionOwner)) return
      pending.delete(id)
      entry.clear()
      if (message.error) entry.reject(new HistoireSdkError(['COLLECTION_FAILED', 'INTERNAL_ERROR', 'RATE_LIMITED', 'INVALID_ARGUMENT', 'INVALID_SELECTOR', 'RESULT_TOO_LARGE', 'CAPABILITY_UNAVAILABLE', 'RUNTIME_CHANGED', 'PREVIEW_NOT_READY', 'CANCELLED', 'TIMEOUT'].includes(message.error.code) ? message.error.code : 'SOURCE_UNAVAILABLE', message.error.message ?? 'Runtime operation failed'))
      else entry.resolve(Object.hasOwn(message, 'result') ? message.result : (message.summary !== undefined ? message.summary : { definitions: message.definitions ?? [], error: null }))
    },
    /** Observe/reject every old operation before publishing replacement readiness. */
    invalidate(code: 'RUNTIME_CHANGED' | 'PREVIEW_NOT_READY' = 'RUNTIME_CHANGED') {
      for (const entry of [...pending.values()]) entry.cancel(new HistoireSdkError(code, 'Runtime owner changed'))
    },
  }
}
