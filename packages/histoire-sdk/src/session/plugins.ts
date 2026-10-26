import type { HistoireErrorCode, HistoireFramePluginInfo, HistoirePluginChannel } from '@histoire/protocol'
import type { HistoirePluginActor, HistoireSessionPlugins } from '../types.js'
import type { SessionContext } from './context.js'
import { HistoireSdkError } from '@histoire/protocol'
import { createPluginChannelHub } from './plugin-hub.js'
import { request } from './request.js'
import { primaryRuntime } from './state.js'

/**
 * Session-owned frame plugin channels. Inventory comes from the descriptor (data-only, nothing
 * evaluated); actors come from runtime notices of the owned primary document and retire with it.
 */
export function createSessionPlugins(context: SessionContext): HistoireSessionPlugins {
  const hub = createPluginChannelHub({
    send: (actor, payload, signal) => {
      const primary = primaryRuntime(context)
      if (primary.runtimeId !== actor.runtimeId) throw new HistoireSdkError('RUNTIME_CHANGED', 'Plugin actor belongs to a retired runtime.')
      return request(context, primary.transport, 'plugin.post', payload, { kind: 'runtime', mountId: primary.handle.id }, signal)
    },
  })
  let status = context.snapshot.status
  let sourceIdentity: string | undefined

  /** Owned primary document, independent of transient public readiness. */
  function currentDocument(): string | null {
    const primary = context.primaryId ? context.mounts.get(context.primaryId) : undefined
    return primary?.active ? primary.runtimeId : null
  }

  /** Installed entry of `pluginId`, if the connected book advertises frame plugins. */
  function installed(pluginId: unknown): HistoireFramePluginInfo | undefined {
    return context.engine?.framePlugins?.available ? context.descriptor?.framePlugins?.find(plugin => plugin.id === pluginId) : undefined
  }

  /** Distinct rejections: disconnected source, unavailable plugin, unsupported contract version. */
  function assertPlugin(pluginId: string): void {
    context.assertConnected()
    const plugin = installed(pluginId)
    if (!plugin) throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Frame plugin is not installed in this book.', { pluginId })
    if (plugin.apiVersion !== 1) throw new HistoireSdkError('PROTOCOL_MISMATCH', 'Unsupported frame plugin contract version.', { pluginId, apiVersion: plugin.apiVersion })
  }

  context.listeners.add((snapshot) => {
    const nextSource = snapshot.source ? JSON.stringify([snapshot.source.sourceId, snapshot.source.epoch]) : undefined
    const retiredSource = (status === 'ready' && snapshot.status !== 'ready') || (sourceIdentity !== undefined && nextSource !== sourceIdentity)
    status = snapshot.status
    sourceIdentity = nextSource
    if (retiredSource) {
      const code: HistoireErrorCode = snapshot.status === 'disposed' ? 'DISPOSED' : snapshot.status === 'ready' ? 'STALE_REVISION' : 'NOT_CONNECTED'
      hub.retire(() => true, code)
      return
    }
    // Only physical document replacement retires actors; selection keeps them.
    const owned = currentDocument()
    hub.retire(actor => actor.runtimeId !== owned, 'RUNTIME_CHANGED')
  })

  context.deliverPlugin = (message) => {
    const story = context.snapshot.catalog.stories.filter(entry => entry.id === message?.target?.storyId)
    if (!installed(message?.pluginId) || message.runtimeId !== currentDocument() || message.target?.storyId !== context.snapshot.selection?.storyId
      || story.length !== 1 || story[0].variants.filter(variant => variant.id === message.target.variantId).length !== 1) {
      hub.reject(message)
      return
    }
    hub.receive(context.copy(message), message.runtimeId)
  }

  return {
    frames: () => {
      context.assertConnected()
      return context.copy(context.engine?.framePlugins?.available ? context.descriptor?.framePlugins ?? [] : [])
    },
    actors: (pluginId) => {
      assertPlugin(pluginId)
      return hub.actors(pluginId).map(({ frameKey: _frameKey, ...actor }): HistoirePluginActor => actor)
    },
    subscribe: listener => hub.subscribe(listener),
    open: (pluginId, frame): HistoirePluginChannel => {
      assertPlugin(pluginId)
      if (typeof frame?.actorId !== 'string') throw new HistoireSdkError('INVALID_ARGUMENT', 'Expected a frame plugin actor.')
      return hub.open(pluginId, frame.actorId)
    },
  }
}
