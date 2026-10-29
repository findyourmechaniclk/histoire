import type { PublicState } from '../protocol.js'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { renderLoadingPage } from '../client/page.js'
import { createStatusChannel } from './events.js'

/** Stable HTTP listener delegates only after coherent generation readiness. */
export function createProxyHttp(read: () => PublicState) {
  let target: string | undefined
  let proxy: Awaited<ReturnType<typeof import('httpxy')['createProxyServer']>> | undefined
  const sockets = new Set<import('node:net').Socket>()
  const upgraded = new Set<import('node:stream').Duplex>()
  const events = createStatusChannel(read)
  const assets = new Map<string, Promise<string>>()
  const server = createServer(async (request, response) => {
    const pathname = (request.url ?? '/').split('?')[0]
    try {
      if (pathname === '/__histoire/dev/events' && request.method === 'GET') return events.connect(request, response)
      if (pathname.startsWith('/__histoire/dev/')) {
        const name = pathname.slice('/__histoire/dev/'.length)
        if (['lifecycle.js', 'particles.js'].includes(name) && ['GET', 'HEAD'].includes(request.method ?? '')) {
          if (!assets.has(name)) assets.set(name, readFile(new URL(`../browser/${name}`, import.meta.url), 'utf8'))
          const asset = await assets.get(name)
          response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' })
          response.end(request.method === 'HEAD' ? undefined : asset)
          return
        }
        response.writeHead(404).end('Not found')
        return
      }
      if (target && proxy) {
        await proxy.web(request, response, { target })
        return
      }
      const document = request.headers.accept?.includes('text/html') || request.headers['sec-fetch-dest'] === 'document'
      // Fetch defaults to */* for extensionless APIs too. Only root has a
      // document fallback; all other routes require explicit navigation intent.
      const html = ['GET', 'HEAD'].includes(request.method ?? '') && (document || (pathname === '/' && !request.headers.accept?.includes('application/json')))
      response.writeHead(html ? 200 : 503, { 'content-type': html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
      response.end(request.method === 'HEAD' ? undefined : html ? renderLoadingPage(read()) : 'Histoire runtime unavailable')
    }
    catch {
      if (!response.headersSent) response.writeHead(503, { 'content-type': 'text/plain', 'cache-control': 'no-store' })
      response.end('Histoire runtime unavailable')
    }
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })
  server.on('upgrade', (request, socket, head) => {
    if (!target || !proxy) {
      socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')
      return
    }
    upgraded.add(socket)
    socket.once('close', () => upgraded.delete(socket))
    void proxy.ws(request, socket as never, { target }, head).catch(() => socket.destroy())
  })
  return {
    server,
    events,
    /** Forwarding library is deliberately absent from initial listener import graph. */
    async prepare() {
      proxy = (await import('httpxy')).createProxyServer({ xfwd: true, ws: true })
    },
    /** Withdraw target synchronously and retire old runtime WebSockets. */
    setTarget(next?: string) {
      target = next
      if (!next) {
        for (const socket of upgraded) socket.destroy()
        upgraded.clear()
      }
    },
    /** Join listener close after terminating owned streams and idle connections. */
    async close() {
      target = undefined
      events.close()
      const closing = server.listening ? new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) : Promise.resolve()
      for (const socket of sockets) socket.destroy()
      await closing
    },
  }
}
