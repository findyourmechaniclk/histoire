import type { DevframeNodeRpcSession, DevframeNodeRpcSessionMeta } from 'devframe/types'
import type { Authorization, Exposure, LiveIdentity, LivePeer } from './types.js'
import { randomUUID } from 'node:crypto'
import { defineDevframe } from 'devframe'
import { createLiveBroker } from './broker.js'
import { createRpcBudget } from './rpc-budget.js'

interface Peer extends LivePeer { session: DevframeNodeRpcSession, method: string }

/** Host must supply verified credentials and document/source authorization. */
export interface DevframeBridgeOptions {
  id?: string
  leaseMs?: number
  timeoutMs?: number
  identifyPeer: (session: DevframeNodeRpcSession) => string | undefined | Promise<string | undefined>
  verifyAttachment: (session: DevframeNodeRpcSession, identity: LiveIdentity, sourceUrl: string) => { identity: LiveIdentity, scopes: readonly Exposure[] } | Promise<{ identity: LiveIdentity, scopes: readonly Exposure[] }>
  isCurrent: (session: DevframeNodeRpcSession, identity: LiveIdentity) => boolean | Promise<boolean>
  authorityVersion: () => number
  allowSource: (url: string) => boolean
  authorize: Authorization
}

/** Create an inert Devframe definition; host owns installation and disconnect hooks. */
export function createDevframeBridge(options: DevframeBridgeOptions) {
  const id = options.id ?? 'histoire'
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) throw new Error('Invalid adapter namespace')
  const peers = new Map<number, Map<string, Peer>>()
  const owned = new Set<() => void>()
  const calls = createRpcBudget(64)
  const retirements = createRpcBudget(64)
  let closed = false
  let closing: Promise<void> | undefined
  const broker = createLiveBroker<Peer>({
    leaseMs: options.leaseMs,
    timeoutMs: options.timeoutMs,
    identifyPeer: peer => options.identifyPeer(peer.session),
    verifyAttachment: (peer, identity, url) => options.verifyAttachment(peer.session, identity, url),
    isCurrent: (peer, identity) => options.isCurrent(peer.session, identity),
    authorityVersion: options.authorityVersion,
    onRetire(peer, attachmentId) {
      const group = peers.get(peer.session.meta.id)
      if (group?.get(attachmentId) === peer) group.delete(attachmentId)
      if (group && !group.size && peers.get(peer.session.meta.id) === group) peers.delete(peer.session.meta.id)
    },
    allowSource: options.allowSource,
    authorize: options.authorize,
  })
  const definition = defineDevframe({
    id,
    name: 'Histoire',
    version: '1',
    packageName: '@histoire/devframe',
    homepage: 'https://histoire.dev',
    description: 'Explicitly paired mounted story inspection',
    setup(ctx) {
      if (closed) throw new Error('Adapter disposed')
      /** Capture transport session synchronously before any asynchronous work. */
      function current() {
        const session = ctx.rpc.getCurrentRpcSession()
        if (!session) throw new Error('Session unavailable')
        return session
      }
      /** Invoke exactly this connection; abort sends matching operation cancellation. */
      function createPeer(session: DevframeNodeRpcSession, method: string): Peer {
        return { session, method, retire() {
          const invoke = session.rpc.$call as (method: string, input: unknown) => Promise<unknown>
          return retirements.call(() => invoke(method, { action: 'retire', operationId: randomUUID() }))
        }, async callHighlight(name, input, signal) {
          const operationId = randomUUID()
          const invoke = session.rpc.$call as (method: string, input: unknown) => Promise<unknown>
          const send = session.rpc.$callEvent as (method: string, input: unknown) => Promise<void>
          const cancel = () => {
            void send(method, { action: 'cancel', operationId }).catch(() => {})
          }
          signal.addEventListener('abort', cancel, { once: true })
          try {
            signal.throwIfAborted()
            const value = await calls.call(() => invoke(method, { action: 'call', operationId, name, input }))
            return { value, async finish(accepted: boolean) {
              signal.removeEventListener('abort', cancel)
              if (accepted) {
                void send(method, { action: 'commit', operationId }).catch(() => {})
                return
              }
              await retirements.call(() => invoke(method, { action: 'cancel', operationId }))
            } }
          }
          catch (error) {
            signal.removeEventListener('abort', cancel)
            throw error
          }
        }, async call(name, input, signal) {
          const operationId = randomUUID()
          const invoke = session.rpc.$call as (method: string, input: unknown) => Promise<unknown>
          const cancel = () => {
            const send = session.rpc.$callEvent as (method: string, input: unknown) => Promise<void>
            void send(method, { action: 'cancel', operationId }).catch(() => {})
          }
          signal.addEventListener('abort', cancel, { once: true })
          try {
            signal.throwIfAborted()
            return await calls.call(() => invoke(method, { action: 'call', operationId, name, input }))
          }
          finally { signal.removeEventListener('abort', cancel) }
        } }
      }
      /** Only delete definitions installed by this adapter instance. */
      function register(name: string, handler: (...args: any[]) => unknown) {
        if (ctx.rpc.definitions.has(name)) throw new Error('Adapter RPC already registered')
        ctx.rpc.register({ name, type: 'action', jsonSerializable: true, setup: () => ({ handler }) })
        const definition = ctx.rpc.definitions.get(name)
        owned.add(() => {
          if (ctx.rpc.definitions.get(name) === definition) {
            ctx.rpc.definitions.delete(name)
          }
        })
      }
      register(`${id}:pair`, async (input: { grant: string, sourceUrl: string, identity: LiveIdentity, scopes: Exposure[], method: string }) => {
        const session = current()
        if (!input || typeof input.method !== 'string' || !new RegExp(`^${id}:attachment:[a-f0-9-]{36}$`).test(input.method)) throw new Error('Pairing unavailable')
        const peer = createPeer(session, input.method)
        const key = `pending:${randomUUID()}`
        const group = peers.get(session.meta.id) ?? new Map<string, Peer>()
        group.set(key, peer)
        peers.set(session.meta.id, group)
        try {
          const attachment = await broker.attach(peer, { grant: input.grant, sourceUrl: input.sourceUrl, identity: input.identity, scopes: input.scopes })
          if (closed || peers.get(session.meta.id) !== group || group.get(key) !== peer) {
            broker.disconnect(peer)
            throw new Error('Pairing unavailable')
          }
          group.set(attachment.attachmentId, peer)
          return attachment
        }
        finally {
          group.delete(key)
          if (!group.size && peers.get(session.meta.id) === group) {
            peers.delete(session.meta.id)
          }
        }
      })
      register(`${id}:heartbeat`, async (attachmentId: string) => {
        const session = current()
        const peer = peers.get(session.meta.id)?.get(attachmentId)
        if (!peer || peer.session.meta !== session.meta) throw new Error('Session unavailable')
        await broker.heartbeat(peer, attachmentId)
        return null
      })
      register(`${id}:detach`, (attachmentId: string) => {
        const session = current()
        const group = peers.get(session.meta.id)
        const peer = group?.get(attachmentId)
        if (peer?.session.meta === session.meta) {
          broker.detach(peer, attachmentId)
          group!.delete(attachmentId)
          if (!group!.size) {
            peers.delete(session.meta.id)
          }
        }
        return null
      })
    },
  })
  return {
    definition,
    broker,
    /** Host-visible count of currently owned and pending transport attachments. */
    getStatus() { return { attachments: [...peers.values()].reduce((count, group) => count + group.size, 0) } },
    /** Call synchronously after host authority changes; omit ID for global changes. */
    invalidate(attachmentId?: string) { broker.invalidate(attachmentId) },
    /** Wire this hook to the caller-owned Devframe instance. */
    onPeerDisconnect(meta: DevframeNodeRpcSessionMeta) {
      const group = peers.get(meta.id)
      if (!group) return
      for (const [attachmentId, peer] of group) {
        if (peer.session.meta === meta) {
          broker.disconnect(peer)
          group.delete(attachmentId)
        }
      }
      if (!group.size) peers.delete(meta.id)
    },
    /** Release only adapter registrations and never close the host connection. */
    dispose() {
      if (closing) return closing
      const completion = Promise.withResolvers<void>()
      closing = completion.promise
      closed = true
      const draining = broker.dispose()
      for (const cleanup of owned) cleanup()
      owned.clear()
      peers.clear()
      void draining.then(completion.resolve, completion.reject)
      return closing
    },
  }
}
