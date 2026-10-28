import { describe, expect, it } from 'vitest'
import { createLiveBroker } from '../node/broker.js'

interface TestPeer { principal: string, call: (name: string, input: unknown, signal: AbortSignal) => Promise<{ value: string }> }

const source = 'https://book.example/base/'
const identity = { projectId: 'project-a', sourceId: 'book', epoch: 'epoch', revision: 'revision', mountId: 'mount', runtimeId: 'runtime', target: { storyId: 'story', variantId: 'variant' } }

/** Transport is external to broker; callbacks model host-verified connections. */
function fixture() {
  const peer = { principal: 'alice', call: async () => ({ value: 'unsaved' }) }
  const other = { principal: 'bob', call: async () => ({ value: 'other' }) }
  const broker = createLiveBroker<TestPeer>({
    identifyPeer: connection => connection.principal,
    verifyAttachment: async (_peer, value) => ({ identity: value, scopes: ['inspection'] }),
    isCurrent: () => true,
    authorize: async ({ principal, attachment }) => principal === attachment.principal,
    authorityVersion: () => 0,
    allowSource: url => url === source,
    leaseMs: 500,
    timeoutMs: 1_000,
  })
  return { broker, peer, other }
}

/** Pair a peer using the same host API available to an embedder. */
async function pair(broker: ReturnType<typeof createLiveBroker>, peer: TestPeer, principal = 'alice') {
  const grant = broker.createGrant({ principal, sourceUrl: source, scopes: ['inspection'] })
  return broker.attach(peer, { grant: grant.token, sourceUrl: source, identity, scopes: ['inspection'] })
}

describe('live broker authority', () => {
  it('isolates principals and consumes each grant once', async () => {
    const { broker, peer, other } = fixture()
    try {
      const grant = broker.createGrant({ principal: 'alice', sourceUrl: source, scopes: ['inspection'] })
      await expect(broker.attach(other, { grant: grant.token, sourceUrl: source, identity, scopes: ['inspection'] })).rejects.toThrow('Pairing unavailable')
      const attachment = await broker.attach(peer, { grant: grant.token, sourceUrl: source, identity, scopes: ['inspection'] })
      await expect(broker.attach(peer, { grant: grant.token, sourceUrl: source, identity, scopes: ['inspection'] })).rejects.toThrow('Pairing unavailable')
      expect(await broker.list('alice')).toEqual([attachment])
      expect(await broker.list('bob')).toEqual([])
      await expect(broker.call('bob', attachment.attachmentId, 'histoire_inspect_session', { kind: 'variant' }, new AbortController().signal)).rejects.toThrow('Session unavailable')
    }
    finally { broker.dispose() }
  })

  it('cannot return a result when cancellation occurs during final authorization', async () => {
    let entered = () => {}
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    let checks = 0
    const { broker, peer } = fixture()
    broker.setAuthorization(async () => {
      checks++
      if (checks === 4) {
        entered()
        await held
      }
      return true
    })
    try {
      const attachment = await pair(broker, peer)
      const controller = new AbortController()
      const result = broker.call('alice', attachment.attachmentId, 'histoire_inspect_session', { kind: 'variant' }, controller.signal)
      const rejected = expect(result).rejects.toThrow('Cancelled')
      await started
      controller.abort()
      release()
      await rejected
    }
    finally {
      release()
      broker.dispose()
    }
  })

  it('rejects duplicate scopes and oversized pairing requests before publishing', async () => {
    const { broker, peer } = fixture()
    try {
      const grant = broker.createGrant({ principal: 'alice', sourceUrl: source, scopes: ['inspection'] })
      await expect(broker.attach(peer, { grant: grant.token, sourceUrl: source, identity, scopes: ['inspection', 'inspection'] })).rejects.toThrow()
      await expect(broker.attach(peer, { grant: grant.token, sourceUrl: source, identity: { ...identity, projectId: 'x'.repeat(20_000) }, scopes: ['inspection'] })).rejects.toThrow()
      expect(await broker.list('alice')).toEqual([])
      const valid = await broker.attach(peer, { grant: grant.token, sourceUrl: source, identity, scopes: ['inspection'] })
      expect((await broker.list('alice')).map(item => item.attachmentId)).toEqual([valid.attachmentId])
    }
    finally { broker.dispose() }
  })

  it('drops an earlier discovery row when authority changes during a later check', async () => {
    let revision = 0
    let entered = () => {}
    let release = () => {}
    let checks = 0
    let held = false
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const peer: TestPeer = { principal: 'alice', call: async () => ({ value: 'unused' }) }
    const broker = createLiveBroker<TestPeer>({
      identifyPeer: peer => peer.principal,
      verifyAttachment: async (_peer, identity) => ({ identity, scopes: ['inspection'] }),
      isCurrent: () => true,
      authorityVersion: () => revision,
      authorize: async () => {
        if (held && ++checks === 2) {
          entered()
          await gate
        }
        ;
        return true
      },
      allowSource: url => url === source,
    })
    try {
      await pair(broker, peer)
      await pair(broker, peer)
      held = true
      const result = broker.list('alice')
      await started
      revision++
      release()
      expect(await result).toEqual([])
    }
    finally {
      release()
      broker.dispose()
    }
  })

  it('promptly aborts an invalidated attachment and leaves another usable', async () => {
    let revision = 0
    let started = () => {}
    let observedAbort = () => {}
    const called = new Promise<void>((resolve) => {
      started = resolve
    })
    const stopped = new Promise<void>((resolve) => {
      observedAbort = resolve
    })
    const alice: TestPeer = { principal: 'alice', call: async (_name, _input, signal) => {
      started()
      return await new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
        observedAbort()
        reject(new Error('cancelled'))
      }, { once: true }))
    } }
    const bob: TestPeer = { principal: 'bob', call: async () => ({ value: 'unaffected' }) }
    const broker = createLiveBroker<TestPeer>({
      identifyPeer: peer => peer.principal,
      verifyAttachment: async (_peer, identity) => ({ identity, scopes: ['inspection'] }),
      isCurrent: () => true,
      authorityVersion: () => revision,
      authorize: async ({ principal, attachment }) => principal === attachment.principal,
      allowSource: url => url === source,
    })
    try {
      const first = await pair(broker, alice)
      const second = await pair(broker, bob, 'bob')
      const result = broker.call('alice', first.attachmentId, 'histoire_inspect_session', { kind: 'variant' })
      const rejected = expect(result).rejects.toThrow('Session unavailable')
      await called
      revision++
      broker.invalidate(first.attachmentId)
      await rejected
      await stopped
      expect(await broker.call('bob', second.attachmentId, 'histoire_inspect_session', { kind: 'variant' })).toEqual({ value: 'unaffected' })
    }
    finally { broker.dispose() }
  })

  it('rejects a held reply after discovery access is withdrawn', async () => {
    let entered = () => {}
    let release = () => {}
    let discover = true
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const peer: TestPeer = { principal: 'alice', call: async () => {
      entered()
      await held
      return { value: 'secret' }
    } }
    const broker = createLiveBroker<TestPeer>({
      identifyPeer: peer => peer.principal,
      verifyAttachment: async (_peer, identity) => ({ identity, scopes: ['inspection'] }),
      isCurrent: () => true,
      authorize: async ({ capability }) => capability !== 'discover' || discover,
      authorityVersion: () => 0,
      allowSource: url => url === source,
    })
    try {
      const attachment = await pair(broker, peer)
      const result = broker.call('alice', attachment.attachmentId, 'histoire_inspect_session', { kind: 'variant' })
      const rejected = expect(result).rejects.toThrow('Session unavailable')
      await started
      discover = false
      release()
      await rejected
    }
    finally {
      release()
      broker.dispose()
    }
  })

  it('aborts work at its peer on policy change and allows a fresh pairing', async () => {
    let started = () => {}
    let observedAbort = () => {}
    const called = new Promise<void>((resolve) => {
      started = resolve
    })
    const cancelled = new Promise<void>((resolve) => {
      observedAbort = resolve
    })
    const alice: TestPeer = { principal: 'alice', call: async (_name, _input, signal) => {
      started()
      return await new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
        observedAbort()
        reject(new Error('cancelled at peer'))
      }, { once: true }))
    } }
    const bob: TestPeer = { principal: 'bob', call: async () => ({ value: 'bob unsaved' }) }
    const broker = createLiveBroker<TestPeer>({
      identifyPeer: peer => peer.principal,
      verifyAttachment: async (_peer, value) => ({ identity: value, scopes: ['inspection'] }),
      isCurrent: () => true,
      authorize: async ({ principal, attachment }) => principal === attachment.principal,
      authorityVersion: () => 0,
      allowSource: url => url === source,
    })
    try {
      const first = await pair(broker, alice)
      const second = await pair(broker, bob, 'bob')
      const pending = broker.call('alice', first.attachmentId, 'histoire_inspect_session', { kind: 'variant' })
      const rejected = expect(pending).rejects.toThrow('Session unavailable')
      await called
      broker.setAuthorization(async ({ principal, attachment }) => principal === attachment.principal)
      await rejected
      await cancelled
      await expect(broker.call('bob', second.attachmentId, 'histoire_inspect_session', { kind: 'variant' })).rejects.toThrow('Session unavailable')
      const renewed = await pair(broker, bob, 'bob')
      expect(await broker.call('bob', renewed.attachmentId, 'histoire_inspect_session', { kind: 'variant' })).toEqual({ value: 'bob unsaved' })
    }
    finally { broker.dispose() }
  })

  it('does not publish an attachment after its connection disconnects during verification', async () => {
    let release = () => {}
    let entered = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const peer = { principal: 'alice', call: async () => ({ value: 'unused' }) }
    const broker = createLiveBroker<TestPeer>({
      identifyPeer: connection => connection.principal,
      verifyAttachment: async (_peer, value) => {
        entered()
        await gate
        return { identity: value, scopes: ['inspection'] }
      },
      isCurrent: () => true,
      authorize: async () => true,
      authorityVersion: () => 0,
      allowSource: url => url === source,
    })
    try {
      const grant = broker.createGrant({ principal: 'alice', sourceUrl: source, scopes: ['inspection'] })
      const result = broker.attach(peer, { grant: grant.token, sourceUrl: source, identity, scopes: ['inspection'] })
      const rejected = expect(result).rejects.toThrow('Pairing unavailable')
      await started
      broker.disconnect(peer)
      release()
      await rejected
      expect(await broker.list('alice')).toEqual([])
    }
    finally {
      release()
      broker.dispose()
    }
  })

  it('joins owned retirement and returns the same promise during reentrant disposal', async () => {
    let release = () => {}
    let started = () => {}
    let reentrant: Promise<void> | undefined
    const acknowledged = new Promise<void>((resolve) => {
      release = resolve
    })
    const called = new Promise<void>((resolve) => {
      started = resolve
    })
    let disposeAgain = () => Promise.resolve()
    const peer = { principal: 'alice', call: async () => ({ value: 'unused' }), retire: () => {
      reentrant = disposeAgain()
      started()
      return acknowledged
    } }
    const broker = createLiveBroker<typeof peer>({
      identifyPeer: peer => peer.principal,
      verifyAttachment: async (_peer, identity) => ({ identity, scopes: ['inspection'] }),
      isCurrent: () => true,
      authorityVersion: () => 0,
      authorize: async () => true,
      allowSource: url => url === source,
    })
    disposeAgain = broker.dispose
    try {
      await pair(broker, peer)
      const first = broker.dispose()
      await called
      expect(reentrant).toBe(first)
      expect(broker.dispose()).toBe(first)
      let settled = false
      void first.then(() => {
        settled = true
      })
      await Promise.resolve()
      expect(settled).toBe(false)
      release()
      await first
      expect(settled).toBe(true)
    }
    finally {
      release()
      await broker.dispose()
    }
  })

  it.each(['failure', 'timeout'] as const)('bounds %s peer retirement and reports incomplete cleanup', async (mode) => {
    const peer = { principal: 'alice', call: async () => ({ value: 'unused' }), retire: () => mode === 'failure' ? Promise.reject(new Error('private detail')) : new Promise<void>(() => {}) }
    const broker = createLiveBroker<typeof peer>({
      identifyPeer: peer => peer.principal,
      verifyAttachment: async (_peer, identity) => ({ identity, scopes: ['inspection'] }),
      isCurrent: () => true,
      authorityVersion: () => 0,
      authorize: async () => true,
      allowSource: url => url === source,
      timeoutMs: 40,
    })
    await pair(broker, peer)
    await expect(broker.dispose()).rejects.toThrow('Attachment retirement incomplete')
  })

  it('expires an inactive attachment without later broker traffic', async () => {
    const { broker, peer } = fixture()
    try {
      const attachment = await pair(broker, peer)
      await new Promise(resolve => setTimeout(resolve, 550))
      await expect(broker.heartbeat(peer, attachment.attachmentId)).rejects.toThrow('Session unavailable')
      expect(await broker.list('alice')).toEqual([])
    }
    finally { broker.dispose() }
  })
})
