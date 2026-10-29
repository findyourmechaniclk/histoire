import type { ViteDevServer } from 'vite'
import type { Context } from '../../context.js'
import { isSameOriginPost, readJsonBody, sendJson } from './http-body.js'
import { registerUiHttpRoute, uiHttpPath } from './http.js'
import { applyPluginChanges, pluginToggleStatus, validatePluginApply } from './plugin-toggle-service.js'

/** Exposes bounded plugin changes only to the active same-origin dev UI. */
export function registerPluginToggleHttp(ctx: Context, server: ViteDevServer, isActive: () => boolean): () => void {
  const endpoint = uiHttpPath(server, '/__histoire/plugins/toggle')
  return registerUiHttpRoute(server, endpoint, async (request, response, next) => {
    if (request.url?.split('?')[0] !== endpoint) return next()
    response.setHeader('cache-control', 'no-store')
    if (ctx.mode !== 'dev' || !isActive() || !isSameOriginPost(request)) return sendJson(response, 403, { error: 'Plugin request refused.' })
    try {
      const body = await readJsonBody(request, 16 * 1024)
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request')
      const input = body as Record<string, unknown>
      if (input.action === 'status' && Object.keys(input).length === 2 && typeof input.requestId === 'string') return sendJson(response, 200, await pluginToggleStatus(ctx, input.requestId))
      if (input.action !== 'apply') throw new Error('Invalid request')
      const { action: _action, ...rest } = input
      const change = validatePluginApply(rest)
      await applyPluginChanges(ctx, change, isActive)
      return sendJson(response, 200, { completion: 'pending' })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : ''
      const safe = /^(?:Config changed|Plugin selection|Plugin changes cancelled|Plugin changes unavailable|Plugin config could not|Another plugin change|Could not apply plugin)/.test(message) ? message : 'Plugin request failed. Check config and server output.'
      return sendJson(response, 400, { error: safe })
    }
  }, isActive)
}
