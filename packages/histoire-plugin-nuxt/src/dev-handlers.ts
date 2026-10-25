import type { EventHandler } from 'h3'
import type { Connect, Plugin } from 'vite'
import { createApp, toNodeListener } from 'h3'

/** Nuxt dev server handler (`addDevServerHandler`), normally served by Nitro. */
export interface NuxtDevHandler {
  route?: string
  handler: unknown
}

/**
 * Serves the dev server handlers of Nuxt modules (e.g. `@nuxt/fonts` serving
 * `/_fonts`) from Histoire's dev server, since there is no Nitro.
 *
 * Only handlers under a route prefix are mounted: catch-all handlers would
 * answer every request. They run before other middlewares, as in Nuxt, so
 * fallbacks modules register for other dev servers never see their requests.
 */
export function nuxtDevHandlersPlugin(handlers: NuxtDevHandler[]): Plugin {
  const mounted = handlers.filter(({ route }) => route && route !== '/' && !/[:*]/.test(route))
  return {
    name: 'histoire-nuxt:dev-handlers',
    enforce: 'pre',
    configureServer(server) {
      for (const { route, handler } of mounted) {
        // Connect strips the route prefix, like Nitro's dev handlers.
        const app = createApp().use('/', handler as EventHandler)
        server.middlewares.use(route, toNodeListener(app) as Connect.NextHandleFunction)
      }
    },
  }
}
