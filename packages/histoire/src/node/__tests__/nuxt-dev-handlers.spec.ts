import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import connect from 'connect'
import { afterEach, describe, expect, it } from 'vitest'
import { nuxtDevHandlersPlugin } from '../../../../histoire-plugin-nuxt/src/dev-handlers.js'

// h3 is a dependency of plugin-nuxt only; Nuxt modules create handlers with it.
const { createError, eventHandler, setResponseHeader } = createRequire(new URL('../../../../histoire-plugin-nuxt/package.json', import.meta.url))('h3')

const servers: Array<ReturnType<typeof createServer>> = []

afterEach(() => {
  for (const server of servers.splice(0)) server.close()
})

/** Serves the plugin's middlewares, then a fallback, like Vite's middleware stack. */
async function serve(plugin: ReturnType<typeof nuxtDevHandlersPlugin>) {
  const app = connect()
  ;(plugin.configureServer as (server: unknown) => void)({ middlewares: app })
  app.use((_req, res) => res.end('vite'))
  const server = createServer(app)
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

describe('plugin-nuxt dev server handlers', () => {
  it('serves Nuxt module dev handlers under their route, before other middlewares', async () => {
    const base = await serve(nuxtDevHandlersPlugin([
      {
        route: '/_fonts',
        handler: eventHandler((event) => {
          if (event.path !== '/font.woff2') throw createError({ statusCode: 404 })
          setResponseHeader(event, 'Cache-Control', 'immutable')
          return 'font'
        }),
      },
      // Catch-all handlers would swallow every request: never mounted.
      { route: '', handler: eventHandler(() => 'catch-all') },
      { route: '/', handler: eventHandler(() => 'root') },
    ]))

    const font = await fetch(`${base}/_fonts/font.woff2`)
    expect(await font.text()).toBe('font')
    expect(font.headers.get('cache-control')).toBe('immutable')
    expect((await fetch(`${base}/_fonts/missing.woff2`)).status).toBe(404)
    expect(await (await fetch(`${base}/story`)).text()).toBe('vite')
  })
})
