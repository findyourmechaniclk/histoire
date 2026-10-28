import type { createLiveBroker } from './broker.js'
import type { LivePeer } from './types.js'
import { measureWireValue, sameInspectionOwner, validateBridgeResult, validateInspectionInput, validateInspectionOwner, validateInspectionResult } from '@histoire/protocol'
import { createMcpHandler, Server } from '@modelcontextprotocol/server'
import { parseDiagnosticRequest } from '../shared/diagnostics.js'
import { parseEventRequest, validateEventPage } from '../shared/events.js'
import { componentKind, LIVE_SERVICES, LIVE_TOOLS } from '../shared/services.js'

/** Optional fetch endpoint; host authenticates each request and owns its server. */
export function createMcpEndpoint<P extends LivePeer>(broker: ReturnType<typeof createLiveBroker<P>>, authenticate: (request: Request) => string | undefined | Promise<string | undefined>) {
  let closed = false
  let active = 0
  let closing: Promise<void> | undefined
  const authenticating = new Set<AbortController>()
  const handler = createMcpHandler((context) => {
    const principal = context.authInfo!.clientId
    const server = new Server({ name: 'histoire-live', version: '1' }, { capabilities: { tools: {}, resources: {} } })
    const { tool, eventTool, diagnosticTool, componentTool, accessibilityTool, highlightTool } = LIVE_TOOLS
    server.setRequestHandler('tools/list', async (_request, extra) => {
      const attachments = await broker.list(principal, extra.mcpReq.signal, true)
      extra.mcpReq.signal.throwIfAborted()
      const scopes = new Set(attachments.flatMap(attachment => attachment.scopes))
      return { tools: [tool, eventTool, diagnosticTool, componentTool, accessibilityTool, highlightTool].filter(item => scopes.has(LIVE_SERVICES[item.name as keyof typeof LIVE_SERVICES].scope)) }
    })
    server.setRequestHandler('resources/list', async (_request, extra) => {
      const resources = (await broker.list(principal, extra.mcpReq.signal)).map(record => ({ uri: `histoire://live/${record.attachmentId}`, name: 'Histoire live session', mimeType: 'application/json' }))
      measureWireValue(resources, { maxBytes: 60 * 1024, maxDepth: 16 })
      return { resources }
    })
    server.setRequestHandler('resources/read', async (request, extra) => {
      const records = await broker.list(principal, extra.mcpReq.signal)
      extra.mcpReq.signal.throwIfAborted()
      const record = records.find(item => `histoire://live/${item.attachmentId}` === request.params.uri)
      if (!record) throw new Error('Session unavailable')
      return { contents: [{ uri: request.params.uri, mimeType: 'application/json', text: JSON.stringify(record) }] }
    })
    server.setRequestHandler('tools/call', async (request, context) => {
      try {
        if (!Object.hasOwn(LIVE_SERVICES, request.params.name)) throw new Error('Invalid request')
        const value = request.params.arguments
        measureWireValue(value, { maxBytes: 16 * 1024, maxDepth: 32 })
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request')
        const { attachmentId, ...input } = value
        if (typeof attachmentId !== 'string' || !attachmentId) throw new Error('Invalid request')
        if ((request.params.name === componentTool.name || request.params.name === accessibilityTool.name || request.params.name === highlightTool.name) && Object.hasOwn(input, 'kind')) throw new Error('Invalid request')
        const event = request.params.name === eventTool.name
        const diagnostic = request.params.name === diagnosticTool.name
        const kind = request.params.name === componentTool.name ? componentKind(input) : request.params.name === accessibilityTool.name ? 'accessibility' : request.params.name === highlightTool.name ? 'highlight' : input.kind
        if (request.params.name === tool.name && kind !== 'variant' && kind !== 'dom') throw new Error('Invalid request')
        let owner
        const eventRequest = event ? parseEventRequest(input) : undefined
        if (eventRequest) {
          owner = eventRequest.expectedOwner
        }
        else if (diagnostic) {
          owner = parseDiagnosticRequest(input).expectedOwner
        }
        else {
          const { kind: _kind, ...options } = input
          if (typeof kind !== 'string') throw new Error('Invalid request')
          validateInspectionInput(kind, options)
          owner = validateInspectionOwner(options.expectedOwner)
          if (!options.target || (options.target as typeof owner.target).storyId !== owner.target.storyId || (options.target as typeof owner.target).variantId !== owner.target.variantId) throw new Error('Invalid request')
        }
        const attachment = (await broker.list(principal, context.mcpReq.signal)).find(item => item.attachmentId === attachmentId)
        context.mcpReq.signal.throwIfAborted()
        if (!attachment || !sameInspectionOwner(owner, attachment.owner)) throw new Error('Session unavailable')
        const payload = event || diagnostic ? input : { ...input, kind }
        const raw = await broker.call(principal, attachmentId, request.params.name, payload, context.mcpReq.signal)
        if (kind === 'highlight') {
          validateBridgeResult('inspection.highlight', raw)
          const result = raw as { owner: typeof owner, observedAt: string }
          if (!sameInspectionOwner(result.owner, owner)) throw new Error('Session unavailable')
          return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] }
        }
        const result = event ? validateEventPage(raw, owner, eventRequest) : validateInspectionResult(raw)
        if (result.mode !== 'live' || !sameInspectionOwner(result.owner, owner) || (diagnostic && (!('inspection' in result) || result.inspection !== 'debug')) || (!event && !diagnostic && 'inspection' in result && result.inspection !== kind)) throw new Error('Session unavailable')
        return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] }
      }
      catch (error) {
        const unavailable = error instanceof Error && error.message.includes('Event lifetime unavailable')
        const result = { ok: false, error: unavailable ? { code: 'STALE_REVISION', message: 'Event history lifetime unavailable' } : { code: 'SESSION_UNAVAILABLE', message: 'Live session unavailable' } }
        return { isError: true, structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] }
      }
    })
    return server
  }, { legacy: 'stateless', responseMode: 'json', maxRequestBodySize: 32 * 1024 })
  return {
    /** Authentication precedes MCP parsing and cannot be supplied through tool arguments. */
    async fetch(request: Request) {
      if (closed) return new Response('Unavailable', { status: 503 })
      if (active >= 64) return new Response('Busy', { status: 429 })
      active++
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const abort = () => controller.abort()
      request.signal.addEventListener('abort', abort, { once: true })
      authenticating.add(controller)
      let off = () => {}
      try {
        if (request.signal.aborted) abort()
        const cancelled = new Promise<never>((_resolve, reject) => {
          const stop = () => reject(new Error('Authentication unavailable'))
          off = () => controller.signal.removeEventListener('abort', stop)
          controller.signal.addEventListener('abort', stop, { once: true })
          if (controller.signal.aborted) stop()
        })
        let principal: string | undefined
        try {
          principal = await Promise.race([authenticate(request.clone()), cancelled])
        }
        catch { return new Response(closed ? 'Unavailable' : 'Unauthorized', { status: closed ? 503 : 401 }) }
        if (closed || controller.signal.aborted || !principal || principal.length > 1024) return new Response('Unauthorized', { status: 401 })
        return await handler.fetch(new Request(request, { signal: controller.signal }), { authInfo: { token: 'verified', clientId: principal, scopes: [] } })
      }
      finally {
        off()
        clearTimeout(timer)
        request.signal.removeEventListener('abort', abort)
        authenticating.delete(controller)
        active--
      }
    },
    /** Close this endpoint, preserving caller-owned broker and HTTP listener. */
    close() {
      if (closing) return closing
      closed = true
      for (const controller of authenticating) controller.abort()
      closing = handler.close()
      return closing
    },
  }
}
