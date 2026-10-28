import type { HtmlTagDescriptor, Plugin } from 'vite'

/** Keep the DevTools client in story documents and suppress the floating dock. */
export function sandboxDevtools(token?: string): Plugin {
  return {
    name: 'histoire:vue-devtools-sandbox',
    apply: 'serve',
    configResolved(config) {
      if (token && !['127.0.0.1', 'localhost', '::1'].includes(String(config.server.host))) throw new Error('Vue DevTools automatic authentication requires a loopback-only development server')
    },
    configureServer(server) {
      if (!token) return
      // Managed and middleware hosts can override Vite's configured host.
      // Check the real listener before serving any pre-approved credential.
      const hmr = server.config.server.hmr
      const listener = (typeof hmr === 'object' && hmr?.server) || server.httpServer
      server.middlewares.use((_request, response, next) => {
        const address = listener?.address()
        if (!address || typeof address === 'string' || !['127.0.0.1', '::1'].includes(address.address)) {
          response.statusCode = 403
          response.end('Vue DevTools requires a loopback-only listener')
          return
        }
        next()
      })
    },
    transform(code, id) {
      if (!id.includes('html-proxy')) return
      // The DevTools panel discovers ancestor clients, so shell clients compete
      // with the actual story's in-page channel.
      if (!id.includes('__sandbox') && code.includes('virtual:vue-devtools-client')) return 'export {}'
      // The stock loader runs before Histoire clears the sandbox body.
      if (code.includes('const s = document.createElement(\'script\'); s.type = \'module\'; s.src =') && code.includes('__devtools/embedded.js')) return 'export {}'
    },
    transformIndexHtml: {
      order: 'pre',
      handler() {
        const tags: HtmlTagDescriptor[] = []
        if (token) {
          // A caller-supplied token must not terminate the inline script element.
          const safeToken = JSON.stringify(token).replaceAll('<', '\\u003c')
          tags.push({ tag: 'script', injectTo: 'head-prepend', children: `globalThis.__DEVFRAME_CONNECTION_AUTH_TOKEN__ = ${safeToken}` })
        }
        return tags
      },
    },
  }
}
