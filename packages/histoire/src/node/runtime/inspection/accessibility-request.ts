import type { HistoireAccessibilityInspection } from '@histoire/protocol'

/** Projection returned by the in-document scanner before source metadata is added. */
export type AccessibilityProjection = Omit<HistoireAccessibilityInspection, 'mode' | 'owner' | 'observedAt' | 'durationMs' | 'inspection'>

/** Correlated isolated request sent only to the exact ready sandbox document. */
export interface AccessibilityRequest {
  /** Request identity. */
  id: string
  /** Private host nonce and source epoch. */
  nonce: string
  epoch: string
  /** Captured document and target. */
  documentId: string
  storyId: string
  variantId: string
  /** Existing runtime transport message identities. */
  requestType: string
  resultType: string
  /** Optional query within the exact story root. */
  selector?: string
  /** Remaining browser session deadline. */
  timeoutMs: number
}

/** Self-contained function serialized by Playwright into the owned host page. */
export function requestPreviewAccessibility(options: AccessibilityRequest): Promise<{ result?: AccessibilityProjection, error?: string }> {
  return new Promise((resolve) => {
    const state = (window as any).__HST_MCP_PREVIEW__
    const frame = document.querySelector<HTMLIFrameElement>('#histoire-mcp-preview')
    const current = () => state?.active && state.ready && state.nonce === options.nonce && state.epoch === options.epoch && state.storyId === options.storyId && state.variantId === options.variantId && state.documentId === options.documentId && state.currentDocumentId() === options.documentId
    let timer: ReturnType<typeof setTimeout>
    /** Remove the listener before delivering a terminal response. */
    function finish(value: { result?: AccessibilityProjection, error?: string }) {
      clearTimeout(timer)
      window.removeEventListener('message', receive)
      resolve(value)
    }
    /** Accept only the captured frame, origin, request and document tuple. */
    function receive(event: MessageEvent) {
      const data = event.data
      if (event.source !== frame?.contentWindow || event.origin !== window.location.origin || !data?.__histoire || data.type !== options.resultType || data.requestId !== options.id) return
      if (!current() || data.documentId !== options.documentId || data.storyId !== options.storyId || data.variantId !== options.variantId) return finish({ error: 'RUNTIME_CHANGED' })
      if (data.error) return finish({ error: typeof data.error.code === 'string' ? data.error.code : 'INTERNAL_ERROR' })
      if (!data.result || typeof data.result !== 'object' || Array.isArray(data.result)) return finish({ error: 'INTERNAL_ERROR' })
      finish({ result: data.result })
    }
    if (!current() || !frame?.contentWindow) return finish({ error: 'RUNTIME_CHANGED' })
    window.addEventListener('message', receive)
    timer = setTimeout(() => finish({ error: 'TIMEOUT' }), options.timeoutMs)
    frame.contentWindow.postMessage({ __histoire: true, type: options.requestType, command: 'inspection.accessibility', inspection: true, payload: { selector: options.selector }, requestId: options.id, documentId: options.documentId, storyId: options.storyId, variantId: options.variantId, mcpNonce: options.nonce, mcpEpoch: options.epoch }, window.location.origin)
  })
}
