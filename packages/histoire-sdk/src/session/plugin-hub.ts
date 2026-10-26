import type { HistoireErrorCode, HistoireJsonValue, HistoirePluginChannel, HistoirePluginChannelEvent, HistoirePluginChannelLimiters, HistoirePluginChannelMessage, HistoirePluginChannelPayload, HistoireTarget } from '@histoire/protocol'
import { createPluginChannelLimiters, getHistoireTargetKey, HistoireSdkError, isHistoirePluginId, isHistoirePluginNotice, validatePluginChannelPayload } from '@histoire/protocol'
import { observeOperation } from './ownership.js'

/** Attached frame plugin actor as one host sees it. */
export interface HistoirePluginHubActor {
  /** Plugin attached to the actor. */
  readonly pluginId: string
  /** Rendered mount identity minted by the frame runtime. */
  readonly actorId: string
  /** Variant rendered by the actor. */
  readonly target: HistoireTarget
  /** Runtime document hosting the actor. */
  readonly runtimeId: string
  /** Host frame identity (canvas frame key); SDK sessions use the runtime document id. */
  readonly frameKey: string
}

/** Transport of one host; delivery is the adapter's job, accounting and lifetime the hub's. */
export interface PluginChannelHubOptions {
  /**
   * Delivers one validated host-to-frame message to the actor's document.
   * @param signal Aborted when the actor retires; implementations cancel pending work.
   */
  send: (actor: HistoirePluginHubActor, payload: HistoirePluginChannelPayload, signal: AbortSignal) => Promise<unknown> | unknown
  /** Clock for rate windows. */
  now?: () => number
}

/** One `on()` registration. */
interface Subscription {
  /** Observed plugin message type. */
  type: string
  /** Plugin callback. */
  listener: (data: HistoireJsonValue, message: HistoirePluginChannelMessage) => void
}

/** Live actor: listeners and in-flight sends die with its controller. */
interface ActorEntry {
  /** Frozen public identity. */
  actor: HistoirePluginHubActor
  /** Aborted at retirement. */
  controller: AbortController
  /** Code pending and later operations reject with once retired. */
  retired?: HistoireErrorCode
  /** Listeners of every channel bound to this actor. */
  listeners: Set<Subscription>
}

/** Rejects with the retirement code as soon as `signal` aborts; never waits for the transport. */
function untilRetired<T>(entry: ActorEntry, work: () => Promise<T> | T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const signal = entry.controller.signal
    const abort = () => reject(new HistoireSdkError(entry.retired ?? 'RUNTIME_CHANGED', 'Plugin actor retired.'))
    if (signal.aborted) return abort()
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve().then(work).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/**
 * Host side of plugin channels shared by SDK sessions and the standalone workbench: actor
 * registry from runtime notices, per-plugin accounting per runtime document, delivery by actor id
 * (never by selected variant), retirement without queues or replay. Source, origin and document
 * checks stay with each adapter before `receive`.
 */
export function createPluginChannelHub(options: PluginChannelHubOptions) {
  const entries = new Map<string, ActorEntry>()
  const documents = new Map<string, HistoirePluginChannelLimiters>()
  const rejected = createPluginChannelLimiters(options.now)
  const changes = new Set<() => void>()
  const failures = new Set<{ pluginId: string, listener: (error: Error) => void }>()
  const key = (pluginId: string, actorId: string) => JSON.stringify([pluginId, actorId])

  /** Rate windows of one runtime document, released with its last actor. */
  function limiters(runtimeId: string): HistoirePluginChannelLimiters {
    let value = documents.get(runtimeId)
    if (!value) documents.set(runtimeId, value = createPluginChannelLimiters(options.now))
    return value
  }

  /** Observers never interrupt hub bookkeeping. */
  function notify(): void {
    for (const listener of [...changes]) {
      try {
        listener()
      }
      catch {}
    }
  }

  /**
   * Retires matching actors: pending sends reject at once with `code`, listeners are released.
   * @returns Whether any actor retired.
   */
  function retire(predicate: (actor: HistoirePluginHubActor) => boolean, code: HistoireErrorCode): boolean {
    let changed = false
    for (const [id, entry] of entries) {
      if (!predicate(entry.actor)) continue
      entries.delete(id)
      entry.retired = code
      entry.listeners.clear()
      entry.controller.abort()
      changed = true
    }
    for (const runtimeId of documents.keys()) {
      if (![...entries.values()].some(entry => entry.actor.runtimeId === runtimeId)) documents.delete(runtimeId)
    }
    if (changed) notify()
    return changed
  }

  /** Counts traffic a host refused before it reached an actor; notices are never charged. */
  function reject(message: { pluginId?: unknown, type?: unknown } | null | undefined): void {
    if (isHistoirePluginId(message?.pluginId) && !(typeof message.type === 'string' && isHistoirePluginNotice(message.type))) rejected.get(message.pluginId).incoming.drop()
  }

  /** Delivers one data message to the listeners of its exact actor. */
  function deliver(entry: ActorEntry, payload: HistoirePluginChannelPayload): void {
    const rates = limiters(entry.actor.runtimeId).get(entry.actor.pluginId)
    if (!rates.incoming.accept()) return
    const message: HistoirePluginChannelMessage = { pluginId: payload.pluginId, actorId: payload.actorId, type: payload.type, data: payload.data, target: { ...entry.actor.target } }
    /** Async consumer failures stay observed but never charge a retired actor. */
    const failed = () => {
      if (!entry.retired) rates.incoming.drop()
    }
    for (const { type, listener } of [...entry.listeners]) {
      if (type !== payload.type) continue
      try {
        void Promise.resolve(listener(structuredClone(message.data), structuredClone(message))).catch(failed)
      }
      catch { failed() }
    }
  }

  return {
    retire,
    reject,
    /**
     * Admits one frame publication whose source and document the adapter already verified.
     * @param event Attributed message or runtime notice.
     * @param frameKey Host frame the document belongs to.
     */
    receive(event: HistoirePluginChannelEvent, frameKey: string): void {
      let payload: HistoirePluginChannelEvent
      try {
        payload = validatePluginChannelPayload(event, true) as HistoirePluginChannelEvent
      }
      catch {
        reject(event)
        return
      }
      const id = key(payload.pluginId, payload.actorId)
      if (payload.type === 'histoire:attached') {
        // Each actor detaches with its own notice; a repeated attach is ignored.
        if (entries.has(id)) return
        const actor: HistoirePluginHubActor = Object.freeze({ pluginId: payload.pluginId, actorId: payload.actorId, target: Object.freeze({ ...payload.target }), runtimeId: payload.runtimeId, frameKey })
        entries.set(id, { actor, controller: new AbortController(), listeners: new Set() })
        notify()
        return
      }
      if (payload.type === 'histoire:detached') {
        retire(actor => actor.pluginId === payload.pluginId && actor.actorId === payload.actorId && actor.runtimeId === payload.runtimeId, 'RUNTIME_CHANGED')
        return
      }
      if (payload.type === 'histoire:error') {
        const data = payload.data as { phase: string, message: string }
        const error = Object.assign(new Error(`frame ${data.phase} failed: ${data.message}`), { phase: data.phase, actorId: payload.actorId })
        for (const failure of [...failures]) {
          try {
            if (failure.pluginId === payload.pluginId) failure.listener(error)
          }
          catch {}
        }
        return
      }
      const entry = entries.get(id)
      if (!entry || entry.actor.runtimeId !== payload.runtimeId || entry.actor.frameKey !== frameKey || getHistoireTargetKey(entry.actor.target) !== getHistoireTargetKey(payload.target)) {
        reject(payload)
        return
      }
      deliver(entry, payload)
    },
    /** Attached actors of one plugin, in attach order. */
    actors(pluginId: string): HistoirePluginHubActor[] {
      return [...entries.values()].filter(entry => entry.actor.pluginId === pluginId).map(entry => entry.actor)
    },
    /**
     * Opens a channel bound to exactly one attached actor; it never retargets.
     * @param pluginId Plugin owning the channel.
     * @param actorId Attached actor.
     * @param owner Aborting it releases this channel's listeners and rejects its later posts.
     */
    open(pluginId: string, actorId: string, owner?: AbortSignal): HistoirePluginChannel {
      const entry = entries.get(key(pluginId, actorId))
      if (!entry) throw new HistoireSdkError('RUNTIME_CHANGED', 'Plugin actor is not attached.', { pluginId })
      const { actor } = entry
      const own = new Set<Subscription>()
      // Owner retirement releases this channel's listeners; actor retirement releases the hook.
      const release = () => {
        for (const listener of own) entry.listeners.delete(listener)
        own.clear()
      }
      owner?.addEventListener('abort', release, { once: true })
      entry.controller.signal.addEventListener('abort', () => owner?.removeEventListener('abort', release), { once: true })
      const dropped = () => Math.min(Number.MAX_SAFE_INTEGER, (documents.get(actor.runtimeId)?.droppedCount(pluginId) ?? 0) + rejected.droppedCount(pluginId))
      return Object.freeze({
        post: (type: string, data: HistoireJsonValue) => observeOperation(untilRetired(entry, async () => {
          if (owner?.aborted) throw new HistoireSdkError('RUNTIME_CHANGED', 'Plugin channel closed.')
          const rates = limiters(actor.runtimeId).get(pluginId)
          let payload: HistoirePluginChannelPayload
          try {
            payload = validatePluginChannelPayload({ pluginId, actorId, type, data })
          }
          catch (error) {
            rates.outgoing.drop()
            throw error
          }
          if (!rates.outgoing.accept()) throw new HistoireSdkError('RATE_LIMITED', 'Plugin channel rate limit exceeded.')
          await options.send(actor, structuredClone(payload), entry.controller.signal)
        })),
        on(type: string, listener: (data: HistoireJsonValue, message: HistoirePluginChannelMessage) => void) {
          if (typeof type !== 'string' || !type || isHistoirePluginNotice(type)) throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid plugin message type.')
          if (typeof listener !== 'function') throw new HistoireSdkError('INVALID_ARGUMENT', 'Expected plugin channel listener.')
          if (entry.retired || owner?.aborted) return () => {}
          const subscription = { type, listener }
          entry.listeners.add(subscription)
          own.add(subscription)
          return () => {
            entry.listeners.delete(subscription)
            own.delete(subscription)
          }
        },
        getDroppedCount: dropped,
      })
    },
    /** Observes attach and detach. */
    subscribe(listener: () => void): () => void {
      changes.add(listener)
      return () => changes.delete(listener)
    },
    /** Observes frame failures attributed to one plugin. */
    onError(pluginId: string, listener: (error: Error) => void): () => void {
      const failure = { pluginId, listener }
      failures.add(failure)
      return () => failures.delete(failure)
    },
  }
}

/** Host-side plugin channel registry. */
export type PluginChannelHub = ReturnType<typeof createPluginChannelHub>
