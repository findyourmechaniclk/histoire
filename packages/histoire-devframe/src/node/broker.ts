import type { Authorization, BrokerOptions, Exposure, LiveAttachment, LiveIdentity, LivePeer } from './types.js'
import { randomUUID } from 'node:crypto'
import { assertServiceOperation, LIVE_SERVICES, serviceScopes } from '../shared/services.js'
import { canonicalSource, createGrants } from './grants.js'
import { createRetirementTracker } from './retirements.js'
import { bounded, isSourceAllowed, readAuthorityVersion, verifiedIdentity } from './validation.js'

interface RecordEntry<P extends LivePeer> {
  peer: P
  principal: string
  attachment: LiveAttachment
  identity: LiveIdentity
  expiresAt: number
  timer: ReturnType<typeof setTimeout>
  pending: Set<AbortController>
}

/** Finite broker is inert until an explicitly authenticated host pairs a peer. */
export function createLiveBroker<P extends LivePeer>(options: BrokerOptions<P>) {
  const grants = createGrants()
  const records = new Map<string, RecordEntry<P>>()
  const generations = new WeakMap<P, number>()
  const pairing = new Set<{ peer: P, controller: AbortController }>()
  const listing = new Set<AbortController>()
  const leaseMs = options.leaseMs ?? 15_000
  const timeoutMs = options.timeoutMs ?? 5_000
  if (!Number.isFinite(leaseMs) || leaseMs < 1 || !Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error('Invalid broker timeout')
  const retirements = createRetirementTracker(timeoutMs)
  let closing: Promise<void> | undefined
  let closed = false
  let policyVersion = 0
  let registryVersion = 0
  let authorize = options.authorize

  /** Invalidate before notifying pending work to prevent reentrant resurrection. */
  function retire(record: RecordEntry<P>, notify = true) {
    if (records.get(record.attachment.attachmentId) !== record) return
    records.delete(record.attachment.attachmentId)
    registryVersion++
    clearTimeout(record.timer)
    for (const pending of record.pending) pending.abort(new Error('Session unavailable'))
    record.pending.clear()
    if (notify && record.peer.retire) retirements.start(() => record.peer.retire!())
    try {
      options.onRetire?.(record.peer, record.attachment.attachmentId)
    }
    catch { /* Host cleanup cannot revive the record. */ }
  }
  /** Never revive an expired lease, even when its timer has not yet fired. */
  function active(record: RecordEntry<P>) {
    if (closed || records.get(record.attachment.attachmentId) !== record) return false
    if (record.expiresAt <= Date.now()) {
      retire(record)
      return false
    }
    return true
  }
  /** Check policy version, connection ownership and lease after every async policy call. */
  async function permitted(record: RecordEntry<P>, principal: string, capability: 'discover' | Exposure, signal?: AbortSignal) {
    if (!active(record)) return false
    const version = policyVersion
    const authority = readAuthorityVersion(options.authorityVersion)
    let allowed = false
    try {
      if (!await options.isCurrent(record.peer, structuredClone(record.identity))) return false
      signal?.throwIfAborted()
      if (version !== policyVersion || authority !== readAuthorityVersion(options.authorityVersion) || !active(record)) return false
      allowed = await authorize({ principal, attachment: { ...structuredClone(record.attachment), principal: record.principal }, identity: structuredClone(record.identity), capability }) === true
      signal?.throwIfAborted()
      if (version !== policyVersion || authority !== readAuthorityVersion(options.authorityVersion) || !active(record) || !allowed) return false
      allowed = await options.isCurrent(record.peer, structuredClone(record.identity)) === true
    }
    catch { return false }
    signal?.throwIfAborted()
    return allowed && version === policyVersion && authority === readAuthorityVersion(options.authorityVersion) && active(record) && isSourceAllowed(options.allowSource, record.attachment.sourceUrl)
  }
  /** Update a lease only after checking the old lease and exact connection object. */
  function renew(record: RecordEntry<P>) {
    clearTimeout(record.timer)
    record.expiresAt = Date.now() + leaseMs
    record.timer = setTimeout(() => retire(record), leaseMs)
    record.timer.unref?.()
  }
  return {
    /** Mint a host-delivered one-use grant; no token is published in discovery. */
    createGrant(input: { principal: string, sourceUrl: string, scopes: readonly Exposure[] }) {
      if (closed || !isSourceAllowed(options.allowSource, canonicalSource(input.sourceUrl))) throw new Error('Pairing unavailable')
      return grants.create({ ...input, authorityVersion: readAuthorityVersion(options.authorityVersion) })
    },
    /** Verify connection identity and source authority before recording attachment. */
    async attach(peer: P, input: { grant: string, sourceUrl: string, identity: LiveIdentity, scopes: readonly Exposure[] }) {
      if (closed || records.size + pairing.size >= 32) throw new Error('Pairing unavailable')
      input = bounded(input, 16 * 1024)
      if (!input || typeof input !== 'object' || Object.keys(input).some(key => !['grant', 'sourceUrl', 'identity', 'scopes'].includes(key))) throw new Error('Pairing unavailable')
      const controller = new AbortController()
      const pending = { peer, controller }
      pairing.add(pending)
      const timer = setTimeout(() => controller.abort(new Error('Pairing unavailable')), timeoutMs)
      let off = () => {}
      try {
        const cancelled = new Promise<never>((_resolve, reject) => {
          const abort = () => reject(controller.signal.reason)
          off = () => controller.signal.removeEventListener('abort', abort)
          controller.signal.addEventListener('abort', abort, { once: true })
        })
        const work = async () => {
          const sourceUrl = canonicalSource(input.sourceUrl)
          if (!isSourceAllowed(options.allowSource, sourceUrl) || !Array.isArray(input.scopes) || input.scopes.length > 6 || new Set(input.scopes).size !== input.scopes.length || input.scopes.some(scope => !['inspection', 'events', 'diagnostics', 'components', 'accessibility', 'highlight'].includes(scope))) throw new Error('Pairing unavailable')
          const version = policyVersion
          const authority = readAuthorityVersion(options.authorityVersion)
          const generation = generations.get(peer) ?? 0
          const principal = await options.identifyPeer(peer)
          if (controller.signal.aborted || closed || version !== policyVersion || authority !== readAuthorityVersion(options.authorityVersion) || generation !== (generations.get(peer) ?? 0) || !principal) throw new Error('Pairing unavailable')
          const grant = grants.redeem(input.grant, principal, sourceUrl, authority)
          const verified = await options.verifyAttachment(peer, bounded(input.identity, 16 * 1024), sourceUrl)
          const identity = verifiedIdentity(verified.identity)
          if (!Array.isArray(verified.scopes) || verified.scopes.length > 6 || new Set(verified.scopes).size !== verified.scopes.length || verified.scopes.some(scope => !['inspection', 'events', 'diagnostics', 'components', 'accessibility', 'highlight'].includes(scope))) throw new Error('Pairing unavailable')
          if (controller.signal.aborted || closed || version !== policyVersion || authority !== readAuthorityVersion(options.authorityVersion) || generation !== (generations.get(peer) ?? 0) || records.size >= 32 || !isSourceAllowed(options.allowSource, sourceUrl)) throw new Error('Pairing unavailable')
          const { sourceId, epoch, revision, runtimeId, target } = identity
          const attachment: LiveAttachment = { attachmentId: randomUUID(), sourceUrl, owner: { sourceId, epoch, revision, runtimeId, target }, scopes: input.scopes.filter(scope => grant.scopes.includes(scope) && verified.scopes.includes(scope)) }
          const record = { peer, principal, attachment, identity, expiresAt: 0, timer: undefined as unknown as ReturnType<typeof setTimeout>, pending: new Set<AbortController>() }
          records.set(attachment.attachmentId, record)
          renew(record)
          return structuredClone(attachment)
        }
        return await Promise.race([work(), cancelled])
      }
      catch { throw new Error('Pairing unavailable') }
      finally {
        off()
        clearTimeout(timer)
        pairing.delete(pending)
      }
    },
    /** Renew only for the exact authenticated connection and still-live record. */
    async heartbeat(peer: P, attachmentId: string) {
      const record = records.get(attachmentId)
      if (!record || !active(record) || record.peer !== peer) throw new Error('Session unavailable')
      renew(record)
    },
    /** Enumerate only currently authorized records, never grants or principals. */
    async list(principal: string, signal?: AbortSignal, authorizeScopes = false) {
      if (closed) throw new Error('Session unavailable')
      if (listing.size >= 16) throw new Error('Request capacity reached')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(new Error('Timed out')), timeoutMs)
      const cancel = () => controller.abort(new Error('Cancelled'))
      signal?.addEventListener('abort', cancel, { once: true })
      listing.add(controller)
      if (signal?.aborted) cancel()
      let off = () => {}
      try {
        const cancelled = new Promise<never>((_resolve, reject) => {
          const abort = () => reject(controller.signal.reason)
          off = () => controller.signal.removeEventListener('abort', abort)
          controller.signal.addEventListener('abort', abort, { once: true })
          if (controller.signal.aborted) abort()
        })
        const work = async () => {
          const result: LiveAttachment[] = []
          const version = policyVersion
          const authority = readAuthorityVersion(options.authorityVersion)
          const snapshotVersion = registryVersion
          for (const record of records.values()) {
            if (!await permitted(record, principal, 'discover', controller.signal)) continue
            const attachment = structuredClone(record.attachment)
            if (authorizeScopes) {
              const scopes: Exposure[] = []
              for (const scope of attachment.scopes) {
                if (await permitted(record, principal, scope, controller.signal)) scopes.push(scope)
              }
              attachment.scopes = scopes
            }
            result.push(attachment)
          }
          controller.signal.throwIfAborted()
          if (closed || version !== policyVersion || authority !== readAuthorityVersion(options.authorityVersion) || snapshotVersion !== registryVersion) return []
          return result.filter((item) => {
            const record = records.get(item.attachmentId)
            return !!record && active(record)
          })
        }
        return await Promise.race([work(), cancelled])
      }
      finally {
        off()
        clearTimeout(timer)
        signal?.removeEventListener('abort', cancel)
        listing.delete(controller)
      }
    },
    /** Route one finite inspection to its exact peer with a bounded lifetime. */
    async call(principal: string, attachmentId: string, name: string, input: unknown, signal?: AbortSignal) {
      const record = records.get(attachmentId)
      if (!record || !active(record) || !Object.hasOwn(LIVE_SERVICES, name)) throw new Error('Session unavailable')
      const payload = bounded(input, 16 * 1024)
      const scopes = serviceScopes(name, payload)
      assertServiceOperation(name, payload)
      const authority = readAuthorityVersion(options.authorityVersion)
      if (record.pending.size >= 4) throw new Error('Request capacity reached')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(new Error('Timed out')), timeoutMs)
      const cancel = () => controller.abort(new Error('Cancelled'))
      signal?.addEventListener('abort', cancel, { once: true })
      record.pending.add(controller)
      if (signal?.aborted) cancel()
      let off = () => {}
      let highlight: Awaited<ReturnType<NonNullable<LivePeer['callHighlight']>>> | undefined
      let accepted = false
      try {
        const cancelled = new Promise<never>((_resolve, reject) => {
          const abort = () => reject(controller.signal.reason)
          off = () => controller.signal.removeEventListener('abort', abort)
          controller.signal.addEventListener('abort', abort, { once: true })
          if (controller.signal.aborted) abort()
        })
        const work = async () => {
          if (!await permitted(record, principal, 'discover', controller.signal)) throw new Error('Session unavailable')
          for (const scope of scopes) {
            if (!record.attachment.scopes.includes(scope) || !await permitted(record, principal, scope, controller.signal)) throw new Error('Session unavailable')
          }
          controller.signal.throwIfAborted()
          if (name === 'histoire_highlight_element' && !record.peer.callHighlight) throw new Error('Session unavailable')
          const value = name === 'histoire_highlight_element'
            ? (highlight = await record.peer.callHighlight!(name, payload, controller.signal)).value
            : await record.peer.call(name, payload, controller.signal)
          controller.signal.throwIfAborted()
          if (!await permitted(record, principal, 'discover', controller.signal)) throw new Error('Session unavailable')
          for (const scope of scopes) {
            if (!record.attachment.scopes.includes(scope) || !await permitted(record, principal, scope, controller.signal)) throw new Error('Session unavailable')
          }
          controller.signal.throwIfAborted()
          if (authority !== readAuthorityVersion(options.authorityVersion)) throw new Error('Session unavailable')
          return bounded(value, 60 * 1024)
        }
        const result = await Promise.race([work(), cancelled])
        accepted = true
        return result
      }
      finally {
        off()
        clearTimeout(timer)
        signal?.removeEventListener('abort', cancel)
        record.pending.delete(controller)
        if (highlight) {
          let cleanupTimer: ReturnType<typeof setTimeout> | undefined
          try {
            await Promise.race([highlight.finish(accepted), new Promise<void>((_resolve, reject) => {
              cleanupTimer = setTimeout(() => reject(new Error('Highlight cleanup timed out')), timeoutMs)
            })])
          }
          finally { clearTimeout(cleanupTimer) }
        }
      }
    },
    /** Host calls immediately after an authority revision to retire affected work. */
    invalidate(attachmentId?: string) {
      for (const entry of listing) entry.abort(new Error('Session unavailable'))
      if (attachmentId === undefined) {
        grants.clear()
        for (const entry of pairing) entry.controller.abort(new Error('Pairing unavailable'))
        for (const record of records.values()) retire(record)
      }
      else {
        const record = records.get(attachmentId)
        if (record) retire(record)
      }
    },
    /** Host policy changes invalidate in-flight calls before replacing policy. */
    setAuthorization(next: Authorization) {
      policyVersion++
      grants.clear()
      for (const entry of pairing) entry.controller.abort(new Error('Pairing unavailable'))
      for (const entry of listing) entry.abort(new Error('Session unavailable'))
      authorize = next
      for (const record of records.values()) retire(record)
    },
    /** Host retires a changed document before accepting another lifetime. */
    detach(peer: P, attachmentId: string) {
      const record = records.get(attachmentId)
      if (record?.peer === peer) retire(record, false)
    },
    /** Disconnect only attachments owned by this exact transport instance. */
    disconnect(peer: P) {
      generations.set(peer, (generations.get(peer) ?? 0) + 1)
      for (const entry of pairing) {
        if (entry.peer === peer) entry.controller.abort(new Error('Pairing unavailable'))
      }
      for (const record of records.values()) {
        if (record.peer === peer) retire(record, false)
      }
    },
    /** Drop owned grants, timers and work; caller owns its connection and server. */
    dispose() {
      if (closing) return closing
      const completion = Promise.withResolvers<void>()
      closing = completion.promise
      closed = true
      policyVersion++
      grants.clear()
      for (const entry of listing) entry.abort(new Error('Session unavailable'))
      for (const entry of pairing) entry.controller.abort(new Error('Pairing unavailable'))
      for (const record of records.values()) retire(record)
      void retirements.drain().then(completion.resolve, completion.reject)
      return closing
    },
  }
}
