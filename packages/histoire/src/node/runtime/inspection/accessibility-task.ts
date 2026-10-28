import type { PreviewSessionOptions } from '../browser/session.js'
import type { ExecutionTask } from '../execution-types.js'
import type { AccessibilityProjection } from './accessibility-request.js'
import { randomUUID } from 'node:crypto'
import { HistoireSdkError } from '@histoire/protocol'
import { RUNTIME_REQUEST, RUNTIME_RESULT } from '@histoire/shared'
import { createPreviewSession } from '../browser/session.js'
import { hasUnconfirmedCleanup } from '../cleanup.js'
import { requestPreviewAccessibility } from './accessibility-request.js'

/** Fixed scanner execution shares the source-owned lane and fresh browser cleanup. */
export function createAccessibilityTask(input: { storyId: string, variantId: string, selector?: string }, options: PreviewSessionOptions): ExecutionTask<{ projection: AccessibilityProjection, documentId: string }> {
  const session = createPreviewSession({ ...options, target: { ...options.target, globals: options.target.globals && { ...options.target.globals } }, deterministicCapture: true })
  return {
    /** Use the authenticated finite runtime request, never caller-provided code. */
    async run(signal) {
      try {
        const ready = await session.open(signal)
        const response = await ready.page.evaluate(requestPreviewAccessibility, { id: randomUUID(), nonce: ready.nonce, epoch: options.target.epoch, documentId: ready.documentId, storyId: input.storyId, variantId: input.variantId, requestType: RUNTIME_REQUEST, resultType: RUNTIME_RESULT, selector: input.selector, timeoutMs: session.remaining() })
        if (signal.aborted) throw new HistoireSdkError('CANCELLED', 'Accessibility audit cancelled')
        if (session.timedOut) throw new HistoireSdkError('TIMEOUT', 'Accessibility audit timed out')
        if (!options.target.isActive() || !await session.isDocumentReady(ready.documentId)) throw new HistoireSdkError('RUNTIME_CHANGED', 'Accessibility document changed')
        if (response.error || !response.result) {
          const code = ['CAPABILITY_UNAVAILABLE', 'INVALID_SELECTOR', 'CANCELLED', 'TIMEOUT', 'RUNTIME_CHANGED', 'PREVIEW_NOT_READY'].includes(response.error ?? '') ? response.error as 'CAPABILITY_UNAVAILABLE' | 'INVALID_SELECTOR' | 'CANCELLED' | 'TIMEOUT' | 'RUNTIME_CHANGED' | 'PREVIEW_NOT_READY' : 'INTERNAL_ERROR'
          throw new HistoireSdkError(code, 'Accessibility audit failed')
        }
        return { projection: response.result, documentId: ready.documentId }
      }
      catch (error) {
        if (hasUnconfirmedCleanup(error)) throw error
        if (signal.aborted) throw new HistoireSdkError('CANCELLED', 'Accessibility audit cancelled')
        if (session.timedOut) throw new HistoireSdkError('TIMEOUT', 'Accessibility audit timed out')
        throw error
      }
    },
    /** Completion remains pending until the browser and host lease are released. */
    async cleanup() { await session.close() },
  }
}
