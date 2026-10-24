import type { Disposer, PluginFrameRef, PluginFrameService } from '@histoire/plugin-kit'
import type { HistoireFramePluginInfo } from '@histoire/protocol'
import type { HistoireSessionPlugins } from '@histoire/sdk'
import type { HistoirePluginHubActor } from '@histoire/sdk/internal'
import { HistoireSdkError, HOST_CHANNEL_MESSAGE } from '@histoire/protocol'
import { createPluginChannelHub } from '@histoire/sdk/internal'
import { watch } from 'vue'

/** One mounted story frame as the canvas frame registry records it. */
export interface FrameDocument {
  /** Canvas frame key. */
  id: string
  /** Rendered story. */
  storyId: string
  /** Rendered variant. */
  variantId: string
  /** Frame element; absent for budget placeholders. */
  iframe?: HTMLIFrameElement | null
  /** Parent-minted identity of the current document. */
  documentId?: string | null
}

/**
 * Fingerprint of the frames a registry holds and their current documents. Reading it inside a
 * Vue watcher tracks the canvas registry (a `shallowReactive` map of `shallowReactive` records),
 * so a removed frame or a replaced document is observed without polling.
 * @param registry Canvas frame registry.
 */
function registryDocuments(registry: FrameDocumentRegistry): string {
  return JSON.stringify([...registry.frames].map(([key, frame]) => [key, frame.documentId ?? null]))
}

/** Structural subset of the canvas frame registry (`createCanvasFrames`). */
export interface FrameDocumentRegistry {
  /** Mounted frames by key; records update when their document is replaced. */
  readonly frames: ReadonlyMap<string, FrameDocument>
  /** Posts to the current same-origin document of one frame. */
  postToFrame: (id: string, payload: Record<string, unknown>) => boolean
}

/**
 * Frame plugin inventory of a session's connected book, `undefined` while unknown (not connected
 * or a session without plugin support).
 * @param session Canonical workbench session.
 */
export function sessionFramePlugins(session: object): readonly HistoireFramePluginInfo[] | undefined {
  try {
    return (session as { plugins?: HistoireSessionPlugins }).plugins?.frames()
  }
  catch {
    return undefined
  }
}

/** Inputs of the standalone frame channels. */
export interface FrameChannelsOptions {
  /** Installed frame plugins (descriptor data); `undefined` while unknown. */
  installed: () => readonly HistoireFramePluginInfo[] | undefined
}

/**
 * Standalone plugin channels. The workbench talks to its own same-origin story frames directly:
 * frame documents post to this window, and replies go through the frame registry's `postToFrame`.
 * Every message must come from a registered frame's window, this origin and that frame's current
 * document; delivery and accounting are the shared SDK hub's, keyed by canvas frame and actor.
 */
export function createFrameChannels(options: FrameChannelsOptions) {
  /** Registered canvases and the window their frames post to. */
  const registries = new Map<FrameDocumentRegistry, Window>()
  /** Stops the registry watcher of each registered canvas. */
  const unwatch = new Map<FrameDocumentRegistry, () => void>()
  const hub = createPluginChannelHub({
    send(actor, payload) {
      const frame = locate(actor)
      if (!frame) throw new HistoireSdkError('RUNTIME_CHANGED', 'Plugin actor document was replaced.')
      if (!frame.registry.postToFrame(actor.frameKey, { type: HOST_CHANNEL_MESSAGE, storyId: actor.target.storyId, variantId: actor.target.variantId, plugin: payload })) {
        throw new HistoireSdkError('RUNTIME_CHANGED', 'Plugin actor frame is unavailable.')
      }
    },
  })

  /** Current registration of the actor's frame, only while its document is still the actor's. */
  function locate(actor: Pick<HistoirePluginHubActor, 'frameKey' | 'runtimeId'>) {
    for (const registry of registries.keys()) {
      const frame = registry.frames.get(actor.frameKey)
      if (frame) return frame.documentId === actor.runtimeId ? { registry, frame } : undefined
    }
    return undefined
  }

  /** Actors whose frame went away or navigated retire before anyone reads or posts. */
  function sweep(): void {
    hub.retire(actor => !locate(actor), 'RUNTIME_CHANGED')
  }

  /** Installed entry, rejecting unavailable plugins and unsupported versions distinctly. */
  function assertInstalled(pluginId: string): void {
    const plugin = options.installed()?.find(entry => entry.id === pluginId)
    if (!plugin) throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Frame plugin is not installed.', { pluginId })
    if (plugin.apiVersion !== 1) throw new HistoireSdkError('PROTOCOL_MISMATCH', 'Unsupported frame plugin contract version.', { pluginId })
  }

  /** Frame-to-workbench traffic: exact window, origin and current document of one frame. */
  function receive(event: MessageEvent): void {
    const data = event.data
    if (!data?.__histoire || data.type !== HOST_CHANNEL_MESSAGE || data.plugin === undefined) return
    sweep()
    let frame: FrameDocument | undefined
    for (const registry of registries.keys()) {
      for (const candidate of registry.frames.values()) {
        if (candidate.iframe?.contentWindow && candidate.iframe.contentWindow === event.source) frame = candidate
      }
    }
    const origin = frame?.iframe?.ownerDocument.defaultView?.location.origin
    const installed = options.installed()?.some(entry => entry.id === data.plugin?.pluginId && entry.apiVersion === 1)
    if (!frame || !frame.documentId || event.origin !== origin || data.documentId !== frame.documentId || data.storyId !== frame.storyId || data.variantId !== frame.variantId || !installed) {
      hub.reject(data.plugin)
      return
    }
    hub.receive({ ...data.plugin, target: { storyId: frame.storyId, variantId: frame.variantId }, runtimeId: frame.documentId }, frame.id)
  }

  const service: PluginFrameService = {
    list(pluginId) {
      sweep()
      return hub.actors(pluginId).map(actor => Object.freeze({ key: actor.frameKey, target: actor.target, actorId: actor.actorId }))
    },
    open(pluginId, frame, signal) {
      assertInstalled(pluginId)
      sweep()
      // An explicit actor (a `PluginFrameRef` from `list()`) must still be attached; a plain
      // frame binds to its current actor.
      const { actorId } = frame as Partial<PluginFrameRef>
      const actor = hub.actors(pluginId).find(actor => actor.frameKey === frame.key && (actorId === undefined || actor.actorId === actorId))
      if (!actor) throw new HistoireSdkError(actorId === undefined ? 'PREVIEW_NOT_READY' : 'RUNTIME_CHANGED', 'Frame plugin is not attached to this frame.', { pluginId })
      return hub.open(pluginId, actor.actorId, signal)
    },
    onError: (pluginId, listener) => hub.onError(pluginId, listener),
    // Fires on attach/detach notices and on retirements of frames the canvas removed or navigated.
    subscribe: listener => hub.subscribe(listener),
  }

  return {
    service,
    /**
     * Adds one canvas frame registry; its frames' documents post to `target`.
     * @returns Removal, retiring the registry's actors.
     */
    registerFrames(registry: FrameDocumentRegistry, target: Window): Disposer {
      unwatch.get(registry)?.()
      registries.set(registry, target)
      target.addEventListener('message', receive)
      // A frame unregistered (lease released, view switched) or navigated without a detach notice
      // retires its actors immediately. Synchronous flush: subscribers learn about it before any
      // later list/open/receive could observe the stale actor.
      unwatch.set(registry, watch(() => registryDocuments(registry), sweep, { flush: 'sync' }))
      return () => {
        if (registries.get(registry) !== target) return
        unwatch.get(registry)?.()
        unwatch.delete(registry)
        registries.delete(registry)
        // Several registries may share one window; keep listening while any remains.
        if (![...registries.values()].includes(target)) target.removeEventListener('message', receive)
        sweep()
      }
    },
    /** Retires every actor and stops listening; registries stay owned by their canvases. */
    dispose(): void {
      for (const target of new Set(registries.values())) target.removeEventListener('message', receive)
      for (const stop of unwatch.values()) stop()
      unwatch.clear()
      registries.clear()
      hub.retire(() => true, 'DISPOSED')
    },
  }
}

/** Standalone frame channels of one workbench. */
export type FrameChannels = ReturnType<typeof createFrameChannels>
