import type { HistoireFramePluginInfo, HistoireTarget } from '@histoire/protocol'
import type { PluginFrameService } from '../host/frames.js'
import type { PluginChannel } from '../types/channel.js'
import type { Disposer } from '../types/common.js'
import type { PluginFrameRef } from '../types/plugin.js'
import { getHistoireTargetKey } from '@histoire/protocol'

/** Frame plugin actor as `session.plugins.actors()` reports it. */
export interface SessionFrameActor {
  /** Attached plugin. */
  readonly pluginId: string
  /** Rendered mount identity; channels bind to it. */
  readonly actorId: string
  /** Variant rendered by the actor. */
  readonly target: HistoireTarget
}

/**
 * Frame plugin messaging of a remote session (`HistoireSession.plugins` from `@histoire/sdk`
 * satisfies it structurally). Data only: the host never evaluates book plugin modules.
 */
export interface SessionFramePlugins {
  /** Frame plugins the connected book advertises. */
  frames: () => readonly HistoireFramePluginInfo[]
  /** Attached actors of one plugin; throws when not connected or not installed. */
  actors: (pluginId: string) => readonly SessionFrameActor[]
  /** Observes actor attach and detach. */
  subscribe: (listener: () => void) => Disposer
  /** Channel bound to exactly one actor. */
  open: (pluginId: string, frame: { readonly actorId: string }) => PluginChannel
}

/** Options of {@link createSessionFrameService}. */
export interface SessionFrameServiceOptions {
  /**
   * Frame key of an actor's variant. Defaults to the target key, which is how native hosts
   * key their single primary frame (`FrameRef.key` of their frame-scoped contexts).
   */
  frameKey?: (target: HistoireTarget) => string
}

/** Coded failure matching SDK error codes without a runtime SDK dependency. */
function failure(code: string, message: string): Error {
  return Object.assign(new Error(`[histoire plugin] ${message}`), { code })
}

/**
 * Wraps a session channel so the plugin's listeners are released when `signal` aborts, and
 * later posts reject instead of reaching a frame the plugin no longer owns.
 * @param channel Session channel bound to one actor.
 * @param signal Plugin lifetime.
 */
function ownedChannel(channel: PluginChannel, signal: AbortSignal): PluginChannel {
  const listeners = new Set<Disposer>()
  signal.addEventListener('abort', () => {
    for (const off of [...listeners]) off()
    listeners.clear()
  }, { once: true })
  return Object.freeze({
    post: (type, data) => signal.aborted ? Promise.reject(failure('RUNTIME_CHANGED', 'plugin was disposed')) : channel.post(type, data),
    on(type, listener) {
      if (signal.aborted) return () => {}
      const off = channel.on(type, listener)
      const release = () => {
        if (listeners.delete(release)) off()
      }
      listeners.add(release)
      return release
    },
    getDroppedCount: () => channel.getDroppedCount(),
  } satisfies PluginChannel)
}

/**
 * Frame service of a native host backed by a remote session's `plugins` API, for
 * `createSessionContext({ frames })`. Lists and opens only actors of frames the session itself
 * mounted; a frame failure inside the book is not observable remotely, so `onError` never fires.
 * @param plugins `session.plugins`.
 * @param options Frame key mapping.
 */
export function createSessionFrameService(plugins: SessionFramePlugins, options: SessionFrameServiceOptions = {}): PluginFrameService {
  const frameKey = options.frameKey ?? getHistoireTargetKey

  /** Attached actors, empty while disconnected or when the book lacks the plugin. */
  function actors(pluginId: string): readonly SessionFrameActor[] {
    try {
      return plugins.actors(pluginId)
    }
    catch {
      return []
    }
  }

  return Object.freeze({
    list: (pluginId: string): readonly PluginFrameRef[] => actors(pluginId).map(actor => Object.freeze({ key: frameKey(actor.target), target: actor.target, actorId: actor.actorId })),
    open(pluginId, frame, signal) {
      if (signal.aborted) throw failure('RUNTIME_CHANGED', `plugin "${pluginId}" was disposed`)
      const explicit = (frame as Partial<PluginFrameRef>).actorId
      // An explicit actor binds exactly; a plain frame binds to its current (latest) actor.
      const actorId = explicit ?? actors(pluginId).filter(actor => frameKey(actor.target) === frame.key).at(-1)?.actorId
      if (!actorId) throw failure('PREVIEW_NOT_READY', 'frame plugin is not attached to this frame')
      return ownedChannel(plugins.open(pluginId, { actorId }), signal)
    },
    onError: () => () => {},
    subscribe: listener => plugins.subscribe(listener),
  } satisfies PluginFrameService)
}
