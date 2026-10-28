import { createServer } from 'node:http'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { describe, expect, it } from 'vitest'
import { createLiveBroker } from '../node/broker.js'
import { createMcpEndpoint } from '../node/mcp.js'

const owner = { sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'runtime', target: { storyId: 'story', variantId: 'variant' } }
const identity = { ...owner, projectId: 'project', mountId: 'mount' }
const sourceUrl = 'https://book.example/'
const output = { mode: 'live', owner, observedAt: '2026-10-28T12:00:00.000Z', durationMs: 1, truncated: false, inspection: 'variant', state: { draft: 'unsaved' }, components: [], propsAvailable: false, omittedValues: 0 } as const

describe('authenticated live MCP endpoint', () => {
  it('hides paired sessions from another principal and returns mounted data only to the owner', async () => {
    const peer = { principal: 'alice', call: async () => output }
    const broker = createLiveBroker<typeof peer>({
      identifyPeer: peer => peer.principal,
      verifyAttachment: async (_peer, identity) => ({ identity, scopes: ['inspection'] }),
      isCurrent: () => true,
      authorityVersion: () => 0,
      allowSource: () => true,
      authorize: async ({ principal, attachment }) => principal === attachment.principal,
    })
    const grant = broker.createGrant({ sourceUrl, principal: 'alice', scopes: ['inspection'] })
    const attachment = await broker.attach(peer, { grant: grant.token, sourceUrl, identity, scopes: ['inspection'] })
    const endpoint = createMcpEndpoint(broker, request => request.headers.get('authorization') === 'Bearer alice' ? 'alice' : request.headers.get('authorization') === 'Bearer bob' ? 'bob' : undefined)
    const connect = async (principal: string) => {
      const client = new Client({ name: 'test', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })
      await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), { fetch: (input, init) => endpoint.fetch(new Request(input, init)), requestInit: { headers: { authorization: `Bearer ${principal}` } } }))
      return client
    }
    let alice: Client | undefined
    let bob: Client | undefined
    try {
      expect((await endpoint.fetch(new Request('http://localhost/mcp'))).status).toBe(401)
      alice = await connect('alice')
      bob = await connect('bob')
      expect((await alice.listResources()).resources.map(resource => resource.uri)).toEqual([`histoire://live/${attachment.attachmentId}`])
      expect((await bob.listResources()).resources).toEqual([])
      const args = { attachmentId: attachment.attachmentId, kind: 'variant', target: owner.target, expectedOwner: owner }
      const denied = await bob.callTool({ name: 'histoire_inspect_session', arguments: args })
      expect(denied.isError).toBe(true)
      const result = await alice.callTool({ name: 'histoire_inspect_session', arguments: args })
      expect(result.isError).not.toBe(true)
      expect(result.structuredContent).toEqual(output)
    }
    finally {
      await alice?.close()
      await bob?.close()
      await endpoint.close()
      broker.dispose()
    }
  })

  it('rejects forged inspection kinds before dispatching scoped component, audit or highlight operations', async () => {
    let calls = 0
    const peer = { principal: 'alice', call: async () => {
      calls++
      return output
    } }
    const broker = createLiveBroker<typeof peer>({
      identifyPeer: peer => peer.principal,
      verifyAttachment: async (_peer, identity) => ({ identity, scopes: ['inspection', 'components'] }),
      isCurrent: () => true,
      authorityVersion: () => 0,
      allowSource: () => true,
      authorize: async () => true,
    })
    const grant = broker.createGrant({ sourceUrl, principal: 'alice', scopes: ['inspection'] })
    const attachment = await broker.attach(peer, { grant: grant.token, sourceUrl, identity, scopes: ['inspection'] })
    const endpoint = createMcpEndpoint(broker, () => 'alice')
    const client = new Client({ name: 'test', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), { fetch: (input, init) => endpoint.fetch(new Request(input, init)) }))
      for (const kind of ['highlight', 'components', 'component', 'componentForElement', 'accessibility']) {
        const input = { kind, target: owner.target, expectedOwner: owner, selector: '#target' }
        const result = await client.callTool({ name: 'histoire_inspect_session', arguments: { attachmentId: attachment.attachmentId, ...input } })
        expect(result.isError).toBe(true)
        expect(calls).toBe(0)
        await expect(broker.call('alice', attachment.attachmentId, 'histoire_inspect_session', input)).rejects.toThrow()
      }
      const componentGrant = broker.createGrant({ sourceUrl, principal: 'alice', scopes: ['components'] })
      const components = await broker.attach(peer, { grant: componentGrant.token, sourceUrl, identity, scopes: ['components'] })
      for (const kind of ['variant', 'dom', 'highlight', 'accessibility']) {
        const input = { kind, target: owner.target, expectedOwner: owner, selector: '#target' }
        const result = await client.callTool({ name: 'histoire_inspect_component', arguments: { attachmentId: components.attachmentId, ...input } })
        expect(result.isError).toBe(true)
        await expect(broker.call('alice', components.attachmentId, 'histoire_inspect_component', input)).rejects.toThrow()
      }
      expect(calls).toBe(0)
    }
    finally {
      await client.close()
      await endpoint.close()
      await broker.dispose()
    }
  })

  it('redacts failing authority callbacks in broker and MCP responses', async () => {
    const secret = 'host-credential-secret'
    let fail = false
    const peer = { principal: 'alice', call: async () => output }
    const broker = createLiveBroker<typeof peer>({
      identifyPeer: peer => peer.principal,
      verifyAttachment: async (_peer, identity) => ({ identity, scopes: ['inspection'] }),
      isCurrent: () => true,
      authorityVersion: () => {
        if (fail) throw new Error(secret)
        return 0
      },
      allowSource: () => true,
      authorize: async () => true,
    })
    const grant = broker.createGrant({ sourceUrl, principal: 'alice', scopes: ['inspection'] })
    const attachment = await broker.attach(peer, { grant: grant.token, sourceUrl, identity, scopes: ['inspection'] })
    const endpoint = createMcpEndpoint(broker, () => 'alice')
    const client = new Client({ name: 'test', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), { fetch: (input, init) => endpoint.fetch(new Request(input, init)) }))
      fail = true
      const listError = await broker.list('alice').catch(error => error)
      const callError = await broker.call('alice', attachment.attachmentId, 'histoire_inspect_session', { kind: 'variant' }).catch(error => error)
      expect(listError.message).toBe('Session unavailable')
      expect((callError as Error).message).toBe('Session unavailable')
      const resourceError = await client.listResources().catch(error => error)
      expect(resourceError.message).not.toContain(secret)
      const toolResult = await client.callTool({ name: 'histoire_inspect_session', arguments: { attachmentId: attachment.attachmentId, kind: 'variant', target: owner.target, expectedOwner: owner } })
      expect(toolResult.isError).toBe(true)
      expect(JSON.stringify(toolResult)).not.toContain(secret)
    }
    finally {
      await client.close()
      await endpoint.close()
      broker.dispose()
    }
  })

  it('settles held authentication when the endpoint closes', async () => {
    let entered = () => {}
    let release = () => {}
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const peer = { principal: 'alice', call: async () => output }
    const broker = createLiveBroker<typeof peer>({
      identifyPeer: peer => peer.principal,
      verifyAttachment: async (_peer, identity) => ({ identity, scopes: ['inspection'] }),
      isCurrent: () => true,
      authorityVersion: () => 0,
      allowSource: () => true,
      authorize: async () => true,
    })
    const endpoint = createMcpEndpoint(broker, async () => {
      entered()
      await held
      return 'alice'
    })
    try {
      const response = endpoint.fetch(new Request('http://localhost/mcp'))
      await started
      await endpoint.close()
      expect((await response).status).toBe(503)
    }
    finally {
      release()
      await endpoint.close()
      broker.dispose()
    }
  })

  it('propagates MCP cancellation to the paired peer and preserves the host server', async () => {
    let started = () => {}
    let aborted = () => {}
    const called = new Promise<void>((resolve) => {
      started = resolve
    })
    const stopped = new Promise<void>((resolve) => {
      aborted = resolve
    })
    const peer = { principal: 'alice', call: async (_name: string, _input: unknown, signal: AbortSignal) => {
      started()
      return await new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
        aborted()
        reject(new Error('cancelled'))
      }, { once: true }))
    } }
    const broker = createLiveBroker<typeof peer>({
      identifyPeer: peer => peer.principal,
      verifyAttachment: async (_peer, identity) => ({ identity, scopes: ['inspection'] }),
      isCurrent: () => true,
      authorityVersion: () => 0,
      allowSource: () => true,
      authorize: async ({ principal, attachment }) => principal === attachment.principal,
    })
    const grant = broker.createGrant({ sourceUrl, principal: 'alice', scopes: ['inspection'] })
    const attachment = await broker.attach(peer, { grant: grant.token, sourceUrl, identity, scopes: ['inspection'] })
    const endpoint = createMcpEndpoint(broker, request => request.headers.get('authorization') === 'Bearer alice' ? 'alice' : undefined)
    const dispatch = toNodeHandler(endpoint)
    const server = createServer((request, response) => {
      if (request.url === '/health') {
        response.end('alive')
        return
      }
      void dispatch(request, response)
    })
    const client = new Client({ name: 'test', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
      })
      const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
      await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: { authorization: 'Bearer alice' } } }))
      const controller = new AbortController()
      const result = client.callTool({ name: 'histoire_inspect_session', arguments: { attachmentId: attachment.attachmentId, kind: 'variant', target: owner.target, expectedOwner: owner } }, { signal: controller.signal })
      const rejected = expect(result).rejects.toThrow()
      await called
      controller.abort()
      await rejected
      await stopped
      await endpoint.close()
      expect(await (await fetch(`${url}/health`)).text()).toBe('alive')
    }
    finally {
      await client.close()
      await endpoint.close()
      broker.dispose()
      if (server.listening) {
        await new Promise<void>((resolve) => {
          server.close(() => resolve())
          server.closeAllConnections()
        })
      }
    }
  })
})
