import type { HistoireSession } from '@histoire/sdk'
import type { DevframeRpcClient } from 'devframe/client'
import { measureWireValue, sameInspectionOwner, validateInspectionOwner } from '@histoire/protocol'
import { assertServiceOperation, LIVE_SERVICES, serviceScopes } from '../shared/services.js'
import { createDiagnosticReader } from './diagnostics.js'
import { createEventReader } from './events.js'
import { createHighlightOperations } from './highlight-operations.js'
import { createInspectionDispatcher } from './inspection.js'
import { startPairing } from './pairing-budget.js'

/** Explicitly pair an already-mounted session with a caller-owned connection. */
export async function attachDevframe(options: { session: HistoireSession, connection: DevframeRpcClient, grant: string, projectId: string, scopes?: readonly ('inspection' | 'events' | 'diagnostics' | 'components' | 'accessibility' | 'highlight')[], id?: string }) {
  const { session, connection } = options
  const id = options.id ?? 'histoire'
  let scopes = options.scopes ?? ['inspection']
  if (!scopes.length || scopes.length > 6 || new Set(scopes).size !== scopes.length || scopes.some(scope => !['inspection', 'events', 'diagnostics', 'components', 'accessibility', 'highlight'].includes(scope))) throw new Error('Invalid attachment options')
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(id) || !options.projectId) throw new Error('Invalid attachment options')
  const snapshot = session.getSnapshot()
  const { source, selection, runtime } = snapshot
  scopes = scopes.filter(scope => scope === 'events' || (scope === 'inspection' && (snapshot.inspection?.variant?.available || snapshot.inspection?.dom?.available)) || (scope === 'diagnostics' && snapshot.inspection?.diagnostics?.available) || (scope === 'components' && (snapshot.inspection?.components?.available || snapshot.inspection?.componentDetails?.available)) || (scope === 'accessibility' && snapshot.inspection?.accessibilityAudit?.available) || (scope === 'highlight' && snapshot.inspection?.highlight?.available && snapshot.inspection?.highlightLease?.available))
  if (!scopes.length) throw new Error('Live capability unavailable')
  if (!source || !selection || !selection.variantId || runtime.status !== 'ready' || !runtime.mountId || !runtime.runtimeId || connection.isTrusted !== true) throw new Error('Live session unavailable')
  const identity = { projectId: options.projectId, sourceId: source.sourceId, epoch: source.epoch, revision: source.revision, mountId: runtime.mountId, runtimeId: runtime.runtimeId, target: { storyId: selection.storyId, variantId: selection.variantId } }
  const owner = { sourceId: identity.sourceId, epoch: identity.epoch, revision: identity.revision, runtimeId: identity.runtimeId, target: identity.target }
  const inspect = createInspectionDispatcher(session, owner)
  const highlights = createHighlightOperations(session, owner)
  let events: ReturnType<typeof createEventReader> | undefined
  let diagnostics: ReturnType<typeof createDiagnosticReader> | undefined
  let closing: Promise<void> | undefined
  const method = `${id}:attachment:${crypto.randomUUID()}`
  const pending = new Map<string, AbortController>()
  const pendingCompletion = new Set<Promise<void>>()
  const cancelled = new Map<string, ReturnType<typeof setTimeout>>()
  let attachmentId: string | undefined
  let disposed = false
  let timer: ReturnType<typeof setInterval> | undefined
  let unsubscribe = () => {}
  let disconnect = () => {}
  const call = connection.call as (name: string, input: unknown) => Promise<any>
  const collector = connection.client
  if (collector.definitions.has(method)) throw new Error('Attachment already registered')
  collector.register({ name: method, type: 'action', jsonSerializable: true, setup: () => ({ handler: async (request: { action: string, operationId: string, name?: string, input?: unknown }) => {
    if (disposed || !request || typeof request.operationId !== 'string' || request.operationId.length > 128) throw new Error('Session unavailable')
    if (request.action === 'retire') {
      await release(true)
      return null
    }
    if (request.action === 'commit' || request.action === 'cancel') {
      const controller = pending.get(request.operationId)
      if (request.action === 'cancel') {
        if (controller) controller.abort()
        else if (!cancelled.has(request.operationId) && cancelled.size < 128) cancelled.set(request.operationId, setTimeout(() => cancelled.delete(request.operationId), 10_000))
      }
      await highlights.finish(request.operationId, request.action === 'commit')
      return null
    }
    if (cancelled.has(request.operationId)) {
      clearTimeout(cancelled.get(request.operationId))
      cancelled.delete(request.operationId)
      throw new Error('Session unavailable')
    }
    if (request.action !== 'call' || !request.name || !Object.hasOwn(LIVE_SERVICES, request.name) || !attachmentId || pending.has(request.operationId) || pending.size >= 4) throw new Error('Session unavailable')
    const controller = new AbortController()
    const completion = Promise.withResolvers<void>()
    pendingCompletion.add(completion.promise)
    pending.set(request.operationId, controller)
    try {
      if (request.name === 'histoire_get_session_diagnostics') {
        if (!diagnostics) {
          throw new Error('Session unavailable')
        }
        return diagnostics.read(request.input)
      }
      if (request.name === 'histoire_get_session_events') {
        if (!events) {
          throw new Error('Session unavailable')
        }
        return events.read(request.input)
      }
      assertServiceOperation(request.name!, request.input)
      const requiredScopes = serviceScopes(request.name!, request.input)
      if (requiredScopes.some(scope => !scopes.includes(scope))) throw new Error('Session unavailable')
      const isHighlight = request.name === 'histoire_highlight_element'
      if (isHighlight && !highlights.hasCapacity(pending.size)) throw new Error('Session unavailable')
      const result = await inspect(request.input, controller.signal)
      if (isHighlight) {
        const lease = result as import('@histoire/protocol').HistoireHighlightLease
        highlights.retain(request.operationId, lease)
        if (controller.signal.aborted || requiredScopes.some(scope => !scopes.includes(scope))) {
          await highlights.finish(request.operationId, false)
          throw new Error('Session unavailable')
        }
        return { owner: lease.owner, observedAt: lease.observedAt }
      }
      if (requiredScopes.some(scope => !scopes.includes(scope))) throw new Error('Session unavailable')
      return result
    }
    finally {
      pending.delete(request.operationId)
      pendingCompletion.delete(completion.promise)
      completion.resolve()
    }
  } }) })
  const ownedDefinition = collector.definitions.get(method)
  /** Drop only this attachment's callback, subscriptions and pending work. */
  function release(remote = false) {
    if (disposed) return closing ?? Promise.resolve()
    disposed = true
    const completion = Promise.withResolvers<void>()
    closing = completion.promise
    if (timer) clearInterval(timer)
    for (const controller of pending.values()) controller.abort()
    pending.clear()
    for (const timer of cancelled.values()) clearTimeout(timer)
    cancelled.clear()
    let failed = false
    try {
      unsubscribe()
    }
    catch { failed = true }
    try {
      events?.dispose()
    }
    catch { failed = true }
    try {
      disconnect()
    }
    catch { failed = true }
    if (collector.definitions.get(method) === ownedDefinition) collector.definitions.delete(method)
    const cleanupHighlights = (async () => {
      let cleanupTimer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<never>((_resolve, reject) => {
        cleanupTimer = setTimeout(() => reject(new Error('Highlight cleanup incomplete')), 3000)
      })
      try {
        await Promise.race([(async () => {
          await Promise.all([...pendingCompletion])
          await highlights.dispose()
        })(), timeout])
      }
      finally { clearTimeout(cleanupTimer) }
    })()
    const observation = diagnostics ? Promise.resolve().then(() => diagnostics!.dispose()) : Promise.resolve()
    const detachment = attachmentId && !remote ? Promise.resolve().then(() => call(`${id}:detach`, attachmentId)) : Promise.resolve()
    void Promise.allSettled([observation, detachment, cleanupHighlights]).then((results) => {
      if (failed || results.some(result => result.status === 'rejected')) completion.reject(new Error('Attachment cleanup incomplete'))
      else completion.resolve()
    })
    return closing
  }
  try {
    events = scopes.includes('events') ? createEventReader(session, owner) : undefined
    /** Public snapshot transitions retire this lifetime, including temporary deselection. */
    const stopSnapshots = session.subscribe((value) => {
      if (!value.source || value.source.sourceId !== identity.sourceId || value.source.epoch !== identity.epoch || value.source.revision !== identity.revision || value.source.url !== source.url || value.runtime.status !== 'ready' || value.runtime.mountId !== identity.mountId || value.runtime.runtimeId !== identity.runtimeId || value.selection?.storyId !== identity.target.storyId || value.selection?.variantId !== identity.target.variantId || (scopes.includes('inspection') && !value.inspection?.variant?.available && !value.inspection?.dom?.available) || (scopes.includes('diagnostics') && !value.inspection?.diagnostics?.available) || (scopes.includes('components') && !value.inspection?.components?.available && !value.inspection?.componentDetails?.available) || (scopes.includes('accessibility') && !value.inspection?.accessibilityAudit?.available) || (scopes.includes('highlight') && (!value.inspection?.highlight?.available || !value.inspection?.highlightLease?.available))) void release().catch(() => {})
    })
    if (disposed) {
      stopSnapshots()
    }
    else { unsubscribe = stopSnapshots }
    const stopConnection = connection.events.on('connection:status', (status) => {
      if (status !== 'connected') {
        void release().catch(() => {})
      }
    })
    if (disposed) {
      stopConnection()
    }
    else { disconnect = stopConnection }
    if (disposed) throw new Error('Session unavailable')
    const pairing = startPairing(connection, () => call(`${id}:pair`, { grant: options.grant, sourceUrl: source.url, identity, scopes, method }))
    void pairing.then((value) => {
      if (disposed && typeof value?.attachmentId === 'string') {
        void call(`${id}:detach`, value.attachmentId).catch(() => {})
      }
    }, () => {})
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Pairing timed out')), 5000)
    })
    const result = await Promise.race([pairing, timeout]).finally(() => clearTimeout(timeoutId))
    if (typeof result?.attachmentId === 'string') attachmentId = result.attachmentId
    measureWireValue(result, { maxBytes: 16 * 1024, maxDepth: 16 })
    if (disposed || !attachmentId || !/^[a-f0-9-]{36}$/.test(attachmentId) || !result || typeof result !== 'object' || Object.keys(result).some(key => !['attachmentId', 'sourceUrl', 'owner', 'scopes'].includes(key)) || result.sourceUrl !== source.url || !sameInspectionOwner(validateInspectionOwner(result.owner), owner) || !Array.isArray(result.scopes) || result.scopes.length > scopes.length || new Set(result.scopes).size !== result.scopes.length || result.scopes.some((scope: string) => !scopes.includes(scope as 'inspection' | 'events' | 'diagnostics' | 'components' | 'accessibility' | 'highlight'))) throw new Error('Session unavailable')
    scopes = result.scopes
    if (result.scopes.includes('diagnostics')) {
      if (!session.getSnapshot().inspection?.diagnostics?.available) throw new Error('Diagnostics unavailable')
      diagnostics = createDiagnosticReader(session, owner)
      void diagnostics.closed.then(() => release()).catch(() => {})
      await diagnostics.ready
      if (disposed) throw new Error('Session unavailable')
    }
    timer = setInterval(() => {
      void call(`${id}:heartbeat`, attachmentId).catch(() => {
        void release().catch(() => {})
      })
    }, 5000)
    return { attachment: result, dispose: release }
  }
  catch (error) {
    await release()
    throw error
  }
}
