import type { HistoireHostChannelMessage, HistoirePluginChannelEvent, HistoireTarget } from '@histoire/protocol'
import type { EmbedSurfaceContext } from '../surfaces.js'
import { createHostChannelRateLimiter, createPluginChannelLimiters, HistoireSdkError, isHistoirePluginNotice, validateHostChannelPayload, validatePluginChannelPayload } from '@histoire/protocol'

/** Owned primary document as the runtime adapter reports it. */
interface RuntimeOwner {
  /** Current runtime document, `null` when retired. */
  id: string | null
  /** Selected target of the document. */
  selected: HistoireTarget | null
  /** Whether a variant of the document acknowledged readiness. */
  ready: (variantId: string) => boolean
}

/** Sandbox application message: host channel body or plugin body, never both. */
interface ApplicationMessage {
  /** Story the sending actor renders. */
  storyId: string
  /** Variant the sending actor renders. */
  variantId: string
  /** Named host channel body. */
  channel?: unknown
  /** Plugin channel body; addressed by actor, not by channel name. */
  plugin?: unknown
}

/** Outer wrapper admits data using same owned primary document and selected envelope as events. */
export function createEmbedHostChannels(context: EmbedSurfaceContext, runtime: () => RuntimeOwner) {
  const incoming = createHostChannelRateLimiter()
  const outgoing = createHostChannelRateLimiter()
  // Plugin traffic has its own per-plugin windows; it never charges named host channels.
  const plugins = createPluginChannelLimiters()
  let documentId: string | null = null
  /** Rate tokens belong to one document across every channel and grid actor. */
  function current() {
    const owner = runtime()
    if (documentId !== owner.id) {
      documentId = owner.id
      incoming.reset()
      outgoing.reset()
      plugins.reset()
    }
    return owner
  }
  /** Descriptor names cannot be replaced by story data or parent payload. */
  function enabled(name: string) {
    const capability = context.descriptor.capabilities.hostChannels
    if (!capability.available || !capability.channels?.includes(name)) throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Host channel is not enabled.')
  }
  /** Exactly one catalog variant matches the sending actor. */
  function known(message: ApplicationMessage): boolean {
    const stories = context.session.getSnapshot().catalog.stories.filter(story => story.id === message.storyId)
    return stories.length === 1 && stories[0].variants.filter(variant => variant.id === message.variantId).length === 1
  }
  /**
   * Relays one plugin body of the owned document. Notices of detached or failing actors pass
   * without readiness (selection may already have moved); data and attach need a ready actor.
   */
  function receivePlugin(owner: RuntimeOwner, message: ApplicationMessage) {
    let pluginId: string | undefined
    try {
      // Unattributed frame body; runtime notices are legitimate in this direction.
      const payload = validatePluginChannelPayload(message.plugin, false, true)
      pluginId = payload.pluginId
      const installed = context.descriptor.capabilities.framePlugins?.available && context.descriptor.framePlugins?.some(plugin => plugin.id === payload.pluginId)
      const notice = isHistoirePluginNotice(payload.type)
      if (!installed || !owner.id || message.storyId !== owner.selected?.storyId || !known(message) || (payload.type !== 'histoire:detached' && payload.type !== 'histoire:error' && !owner.ready(message.variantId))) throw new HistoireSdkError('RUNTIME_CHANGED', 'Plugin actor unavailable.')
      if (!notice && !plugins.get(payload.pluginId).incoming.accept()) return
      const value: HistoirePluginChannelEvent = { ...payload, runtimeId: owner.id, target: { storyId: message.storyId, variantId: message.variantId } }
      context.bridge.post('plugin.message', value, { runtimeId: owner.id, target: owner.selected! })
    }
    catch {
      if (pluginId) plugins.get(pluginId).incoming.drop()
    }
  }
  return {
    /** Hostile/malformed/stale messages stop here, before parent callbacks. */
    receive(message: ApplicationMessage) {
      const owner = current()
      if (message.plugin !== undefined) {
        receivePlugin(owner, message)
        return
      }
      try {
        const payload = validateHostChannelPayload(message.channel)
        enabled(payload.name)
        if (!owner.id || message.storyId !== owner.selected?.storyId || !owner.ready(message.variantId) || !known(message)) {
          return
        }
        if (!incoming.accept()) return
        const value: HistoireHostChannelMessage = { ...payload, runtimeId: owner.id, target: { storyId: message.storyId, variantId: message.variantId } }
        context.bridge.post('channel.message', value, { runtimeId: owner.id, target: owner.selected! })
      }
      catch { incoming.drop() }
    },
    /** Host posts reach selected ready primary only; runtime requests retain exact capture. */
    admit(payload: unknown) {
      current()
      const value = validateHostChannelPayload(payload)
      enabled(value.name)
      if (!outgoing.accept()) throw new HistoireSdkError('RATE_LIMITED', 'Host channel rate limit exceeded.')
    },
    /** Diagnostic loss count is bounded and retained only for active runtime. */
    getDroppedCount: () => Math.min(Number.MAX_SAFE_INTEGER, incoming.droppedCount + outgoing.droppedCount),
    /** Teardown retains no work, messages or callback closures. */
    close() {
      incoming.reset()
      outgoing.reset()
      plugins.reset()
      documentId = null
    },
  }
}
