import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { expect, it } from 'vitest'
import { createLiveBroker } from '../node/broker.js'
import { createMcpEndpoint } from '../node/mcp.js'

const owner = { sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'runtime', target: { storyId: 'story', variantId: 'variant' } }
const identity = { ...owner, projectId: 'project', mountId: 'mount' }
const sourceUrl = 'https://book.example/'

it('requires both scopes and fresh authorization for component highlights while preserving selector access', async () => {
  let allowComponents = true
  let hold = false
  let release = () => {}
  let started = () => {}
  const entered = new Promise<void>((resolve) => {
    started = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const calls: unknown[] = []
  const invoke = async (_name: string, input: unknown) => {
    calls.push(structuredClone(input))
    if (hold) {
      started()
      await gate
    }
    return { owner, observedAt: '2026-10-28T12:00:00.000Z' }
  }
  const completed: boolean[] = []
  const peer = { principal: 'alice', call: invoke, callHighlight: async (name: string, input: unknown) => ({ value: await invoke(name, input), finish: async (accepted: boolean) => {
    completed.push(accepted)
  } }) }
  const broker = createLiveBroker<typeof peer>({
    identifyPeer: peer => peer.principal,
    verifyAttachment: async (_peer, identity) => ({ identity, scopes: ['components', 'highlight'] }),
    isCurrent: () => true,
    authorityVersion: () => 0,
    allowSource: () => true,
    authorize: async ({ capability }) => capability !== 'components' || allowComponents,
  })
  const pair = async (scopes: ('components' | 'highlight')[]) => {
    const grant = broker.createGrant({ sourceUrl, principal: 'alice', scopes })
    return broker.attach(peer, { grant: grant.token, sourceUrl, identity, scopes })
  }
  const endpoint = createMcpEndpoint(broker, () => 'alice')
  const client = new Client({ name: 'test', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })
  try {
    const highlightOnly = await pair(['highlight'])
    const componentOnly = await pair(['components'])
    const both = await pair(['components', 'highlight'])
    await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), { fetch: (input, init) => endpoint.fetch(new Request(input, init)) }))
    const args = { target: owner.target, expectedOwner: owner }
    const selector = await client.callTool({ name: 'histoire_highlight_element', arguments: { ...args, attachmentId: highlightOnly.attachmentId, selector: '#target' } })
    expect(selector.structuredContent).toEqual({ owner, observedAt: '2026-10-28T12:00:00.000Z' })
    const denied = await client.callTool({ name: 'histoire_highlight_element', arguments: { ...args, attachmentId: highlightOnly.attachmentId, componentId: 'component' } })
    expect(denied.isError).toBe(true)
    expect(calls).toHaveLength(1)
    const missingHighlight = await client.callTool({ name: 'histoire_highlight_element', arguments: { ...args, attachmentId: componentOnly.attachmentId, componentId: 'component' } })
    expect(missingHighlight.isError).toBe(true)
    const ambiguous = await client.callTool({ name: 'histoire_highlight_element', arguments: { ...args, attachmentId: both.attachmentId, selector: '#target', componentId: 'component' } })
    expect(ambiguous.isError).toBe(true)
    expect(calls).toHaveLength(1)
    const allowed = await client.callTool({ name: 'histoire_highlight_element', arguments: { ...args, attachmentId: both.attachmentId, componentId: 'component' } })
    expect(allowed.structuredContent).toEqual({ owner, observedAt: '2026-10-28T12:00:00.000Z' })
    expect(calls[1]).toEqual({ ...args, componentId: 'component', kind: 'highlight' })
    allowComponents = false
    const policyDenied = await client.callTool({ name: 'histoire_highlight_element', arguments: { ...args, attachmentId: both.attachmentId, componentId: 'component' } })
    expect(policyDenied.isError).toBe(true)
    expect(calls).toHaveLength(2)
    const selectorStillAllowed = await client.callTool({ name: 'histoire_highlight_element', arguments: { ...args, attachmentId: both.attachmentId, selector: '#target' } })
    expect(selectorStillAllowed.isError).not.toBe(true)
    allowComponents = true
    hold = true
    const pending = client.callTool({ name: 'histoire_highlight_element', arguments: { ...args, attachmentId: both.attachmentId, componentId: 'component' } })
    await entered
    allowComponents = false
    release()
    expect((await pending).isError).toBe(true)
    expect(completed).toEqual([true, true, true, false])
  }
  finally {
    release()
    await client.close()
    await endpoint.close()
    await broker.dispose()
  }
})
