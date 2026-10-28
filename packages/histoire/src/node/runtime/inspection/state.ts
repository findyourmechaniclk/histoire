import type { HistoireVariantProjection as VariantStateProjection } from '@histoire/protocol'
import type { PreviewTestCommand } from '../browser/preview-test-script.js'

/** Finite state read uses existing runtime message names and exact ready document. */
export function requestPreviewState(options: Omit<PreviewTestCommand, 'kind'> & { requestType: string, resultType: string, timeoutMs: number }): Promise<VariantStateProjection> {
  return new Promise((resolve, reject) => {
    const state = (window as any).__HST_MCP_PREVIEW__
    const frame = document.querySelector<HTMLIFrameElement>('#histoire-mcp-preview')
    /** WindowProxy survives reload; every dispatch and reply checks document identity. */
    const current = () => state?.active && state.ready && state.nonce === options.nonce && state.epoch === options.epoch && state.storyId === options.storyId && state.variantId === options.variantId && state.documentId === options.documentId && state.currentDocumentId() === options.documentId
    let timer: ReturnType<typeof setTimeout>
    /** Remove listeners before resolving so repeated replies cannot retain owners. */
    function finish(value?: VariantStateProjection, error?: Error): void {
      clearTimeout(timer)
      window.removeEventListener('message', receive)
      if (error) reject(error)
      else resolve(value!)
    }
    /** Reject foreign frames, replaced documents and unrelated request identifiers. */
    function receive(event: MessageEvent): void {
      const data = event.data
      if (event.source !== frame?.contentWindow || event.origin !== window.location.origin || !data?.__histoire || data.type !== options.resultType || data.requestId !== options.id) return
      if (!current() || data.documentId !== options.documentId || data.storyId !== options.storyId || data.variantId !== options.variantId) {
        finish(undefined, new Error('Inspection document changed'))
        return
      }
      if (data.error || !data.result || typeof data.result !== 'object' || Array.isArray(data.result)) {
        finish(undefined, new Error('Runtime state unavailable'))
        return
      }
      finish(data.result as VariantStateProjection)
    }
    if (!current() || !frame?.contentWindow) {
      finish(undefined, new Error('Inspection document changed'))
      return
    }
    window.addEventListener('message', receive)
    timer = setTimeout(() => finish(undefined, new Error('Runtime inspection timed out')), options.timeoutMs)
    frame.contentWindow.postMessage({ __histoire: true, type: options.requestType, command: 'state.get', inspection: true, payload: null, requestId: options.id, documentId: options.documentId, storyId: options.storyId, variantId: options.variantId, mcpNonce: options.nonce, mcpEpoch: options.epoch }, window.location.origin)
  })
}
