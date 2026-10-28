import { createServer } from 'node:http'
import { expect, it, vi } from 'vitest'
import { mountDevframeHost } from '../host/index.js'

it('mounts explicitly on a caller server, rejects duplicates, and leaves unrelated routes and listeners alive', async () => {
  let host: Awaited<ReturnType<typeof mountDevframeHost>> | undefined
  let other: Awaited<ReturnType<typeof mountDevframeHost>> | undefined
  let socket: WebSocket | undefined
  const server = createServer((req, res) => {
    if (req.url === '/health') return void res.end('alive')
    host?.nodeMiddleware(req, res, () => other?.nodeMiddleware(req, res, () => {
      res.statusCode = 404
      res.end()
    }))
  })
  const onUpgrade = () => {}
  server.on('upgrade', onUpgrade)
  const options = {
    server,
    base: '/nested/histoire/',
    origin: 'http://127.0.0.1',
    auth: { rpcFunctions: [], authorize: () => false, onConnect() {}, printBanner() {} },
    bridge: {
      identifyPeer: () => undefined,
      verifyAttachment: (_peer: any, identity: any) => ({ identity, scopes: [] }),
      isCurrent: () => false,
      authorityVersion: () => 0,
      allowSource: () => false,
      authorize: () => false,
    },
  }
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    host = await mountDevframeHost(options)
    expect((await fetch(`${origin}/nested/histoire/__connection.json`)).status).toBe(200)
    expect((await fetch(`${origin}/nested/histoire/__mcp`)).status).toBe(404)
    await expect(mountDevframeHost(options)).rejects.toThrow('Host mount already exists')
    await expect(mountDevframeHost({ ...options, base: '/nested/histoire/child/' })).rejects.toThrow('Host mount already exists')
    other = await mountDevframeHost({ ...options, base: '/other/' })
    socket = new WebSocket(`${origin.replace('http:', 'ws:')}/other/__ws`)
    await new Promise<void>((resolve, reject) => {
      socket!.addEventListener('open', () => resolve(), { once: true })
      socket!.addEventListener('error', reject, { once: true })
    })
    const originalDispose = host.bridge.dispose
    let reentrant: Promise<void> | undefined
    vi.spyOn(host.bridge, 'dispose').mockImplementationOnce(() => {
      reentrant = host!.dispose()
      return originalDispose()
    })
    const closing = host.dispose()
    expect(reentrant).toBe(closing)
    await closing
    expect(socket.readyState).toBe(WebSocket.OPEN)
    expect(await (await fetch(`${origin}/health`)).text()).toBe('alive')
    expect((await fetch(`${origin}/nested/histoire/__connection.json`)).status).toBe(404)
    expect(server.listeners('upgrade')).toContain(onUpgrade)
    host = await mountDevframeHost(options)
    expect((await fetch(`${origin}/nested/histoire/__connection.json`)).status).toBe(200)
  }
  finally {
    socket?.close()
    await other?.dispose()
    await host?.dispose()
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
  }
})

it('routes authenticated peers through the broker and retires them on host disposal', async () => {
  const { randomUUID } = await import('node:crypto')
  const { getDevframeRpcClient } = await import('devframe/client')
  const { attachDevframe } = await import('../client/attach.js')
  const principalByPeer = new Map<number, string>()
  const token = randomUUID()
  let host: Awaited<ReturnType<typeof mountDevframeHost>> | undefined
  const server = createServer((req, res) => host?.nodeMiddleware(req, res, () => {
    res.statusCode = 404
    res.end()
  }))
  let client: Awaited<ReturnType<typeof getDevframeRpcClient>> | undefined
  let denied: Awaited<ReturnType<typeof getDevframeRpcClient>> | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    const source = { sourceId: 'book', epoch: 'epoch', revision: 'revision', url: 'http://book.example/', mode: 'dev' } as const
    const target = { storyId: 'story', variantId: 'variant' }
    const owner = { sourceId: source.sourceId, epoch: source.epoch, revision: source.revision, runtimeId: 'runtime', target }
    host = await mountDevframeHost({
      server,
      base: '/nested/histoire/',
      origin,
      auth: {
        rpcFunctions: [{ name: 'anonymous:devframe:auth', type: 'action', setup: ctx => ({ handler: () => ({ isTrusted: ctx.rpc.getCurrentRpcSession()?.meta.isTrusted === true }) }) }],
        authorize: (name, session) => name.startsWith('anonymous:') || session.meta.isTrusted === true,
        onConnect(connection, session) {
          if (new URL(connection.request?.url ?? '/', origin).searchParams.get('devframe_auth_token') === token) {
            principalByPeer.set(session.meta.id, 'alice')
            session.meta.isTrusted = true
          }
        },
        printBanner() {},
      },
      bridge: {
        identifyPeer: peer => principalByPeer.get(peer.meta.id),
        verifyAttachment: (_peer, identity) => ({ identity, scopes: ['inspection'] }),
        isCurrent: () => true,
        authorityVersion: () => 0,
        allowSource: url => url === source.url,
        authorize: ({ principal, attachment }) => principal === attachment.principal,
      },
      onPeerDisconnect: (_connection, meta) => { principalByPeer.delete(meta.id) },
    })
    const originalLocation = globalThis.location
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin, href: `${origin}/` } })
    try {
      client = await getDevframeRpcClient({ baseURL: `${origin}/nested/histoire/`, authToken: token, webmcp: false, simpleAuth: false, otpParam: false, callTimeout: 2000 })
      await client.ensureTrusted()
      const grant = host.bridge.broker.createGrant({ principal: 'alice', sourceUrl: source.url, scopes: ['inspection'] })
      denied = await getDevframeRpcClient({ baseURL: `${origin}/nested/histoire/`, authToken: randomUUID(), webmcp: false, simpleAuth: false, otpParam: false, callTimeout: 1000 })
      const deniedCall = denied.call as (name: string, input: unknown) => Promise<unknown>
      await expect(deniedCall('histoire:pair', { grant: grant.token, sourceUrl: source.url, identity: { ...owner, projectId: 'project', mountId: 'mount' }, scopes: ['inspection'], method: `histoire:attachment:${randomUUID()}` })).rejects.toThrow()
      const session = {
        getSnapshot: () => ({ source, selection: target, runtime: { status: 'ready', mountId: 'mount', runtimeId: 'runtime' }, inspection: { variant: { available: true } } }),
        subscribe: () => () => {},
        inspect: { variant: async () => ({ mode: 'live', owner, observedAt: '2026-10-28T12:00:00.000Z', durationMs: 1, truncated: false, inspection: 'variant', state: { value: 'alice' }, components: [], propsAvailable: false, omittedValues: 0 }) },
      }
      const attachment = await attachDevframe({ session: session as any, connection: client, grant: grant.token, projectId: 'project' })
      const request = { kind: 'variant', target, expectedOwner: owner }
      expect(await host.bridge.broker.call('alice', attachment.attachment.attachmentId, 'histoire_inspect_session', request)).toMatchObject({ state: { value: 'alice' } })
      await expect(host.bridge.broker.call('bob', attachment.attachment.attachmentId, 'histoire_inspect_session', request)).rejects.toThrow('Session unavailable')
      await host.dispose()
      expect(host.bridge.getStatus().attachments).toBe(0)
      await attachment.dispose()
      await vi.waitFor(() => expect(principalByPeer.size).toBe(0))
    }
    finally {
      Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation })
    }
  }
  finally {
    denied?.close?.()
    client?.close?.()
    await host?.dispose()
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
  }
})
