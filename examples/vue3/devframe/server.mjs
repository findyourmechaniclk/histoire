import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mountDevframeHost } from '@histoire/devframe/host'
import { createMcpEndpoint } from '@histoire/devframe/node'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { createHistoireProject } from 'histoire/node'
import { createServer as createViteServer } from 'vite'

/** Start a loopback-only demonstration with temporary credentials. */
async function main() {
  // Enable Vue DevTools for the local source workbench.
  process.env.HISTOIRE_VUE_DEVTOOLS = 'true'
  // This example binds only to loopback and uses throwaway credentials on every run.
  const port = Number(process.env.HISTOIRE_DEVFRAME_PORT ?? 4638)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid example port')
  const origin = `http://127.0.0.1:${port}`
  process.env.HISTOIRE_DEVFRAME_ORIGIN = origin
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const browserToken = randomUUID()
  const agentToken = randomUUID()
  process.env.HISTOIRE_VUE_DEVTOOLS_TOKEN = randomUUID()
  const principal = randomUUID()
  const peers = new Map()
  const scopes = ['inspection', 'events', 'components', 'accessibility', 'highlight', 'diagnostics']
  let authority = 0
  let host
  let endpoint
  let vite

  const project = await createHistoireProject({ root })
  let bookUrl
  const server = createServer((request, response) => {
    // Reject alternate hosts, including DNS rebinding to the loopback listener.
    if (request.headers.host !== `127.0.0.1:${port}`) {
      response.writeHead(403).end()
      return
    }
    if (request.url === '/demo/config') {
      if (request.headers['sec-fetch-site'] !== 'same-origin') {
        response.writeHead(403).end()
        return
      }
      const grant = host.bridge.broker.createGrant({ principal, sourceUrl: bookUrl, scopes })
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      response.end(JSON.stringify({ bookUrl, browserToken, grant: grant.token, scopes }))
    }
    else if (request.url?.startsWith('/mcp')) {
      void toNodeHandler(endpoint)(request, response)
    }
    else if (request.url?.startsWith('/devframe/')) {
      host.nodeMiddleware(request, response)
    }
    else {
      vite.middlewares(request, response)
    }
  })

  try {
    const dev = await project.startDev({ host: '127.0.0.1', port: 0, open: false })
    await dev.ready
    bookUrl = dev.url
    host = await mountDevframeHost({
      server,
      base: '/devframe/',
      origin,
      allowedOrigins: [origin],
      auth: {
        rpcFunctions: [{ name: 'anonymous:devframe:auth', type: 'action', setup: ctx => ({ handler: () => ({ isTrusted: ctx.rpc.getCurrentRpcSession()?.meta.isTrusted === true }) }) }],
        authorize: (name, session) => name.startsWith('anonymous:') || session.meta.isTrusted === true,
        onConnect(connection, session) {
          const token = new URL(connection.request?.url ?? '/', origin).searchParams.get('devframe_auth_token')
          session.meta.isTrusted = token === browserToken
          if (session.meta.isTrusted) peers.set(session.meta.id, principal)
        },
        printBanner() {},
      },
      bridge: {
        identifyPeer: peer => peers.get(peer.meta.id),
        verifyAttachment(peer, identity, url) {
          if (peers.get(peer.meta.id) !== principal || url !== bookUrl || identity.projectId !== 'vue3-example') throw new Error('Denied')
          return { identity, scopes }
        },
        isCurrent: peer => peers.get(peer.meta.id) === principal,
        allowSource: url => url === bookUrl,
        authorize: request => request.principal === principal && request.attachment.principal === principal,
        authorityVersion: () => authority,
      },
      onPeerDisconnect: (_connection, meta) => peers.delete(meta.id),
    })
    endpoint = createMcpEndpoint(host.bridge.broker, request => request.headers.get('authorization') === `Bearer ${agentToken}` ? principal : undefined)
    vite = await createViteServer({ configFile: false, root: resolve(root, 'devframe'), server: { middlewareMode: true, hmr: false } })
    await new Promise((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolve))
    process.stdout.write(`Open ${origin}/\nMCP endpoint: ${origin}/mcp\nMCP Authorization header: Bearer ${agentToken}\n`)
  }
  catch (error) {
    await endpoint?.close()
    await project.close()
    await host?.dispose()
    await vite?.close()
    throw error
  }

  /** Retire attachments and close only resources owned by this example. */
  async function close() {
    authority++
    host.bridge.invalidate()
    await endpoint.close()
    await host.dispose()
    await vite.close()
    await project.close()
    await new Promise(resolve => server.close(resolve))
  }
  process.once('SIGINT', () => void close().finally(() => process.exit()))
  process.once('SIGTERM', () => void close().finally(() => process.exit()))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
