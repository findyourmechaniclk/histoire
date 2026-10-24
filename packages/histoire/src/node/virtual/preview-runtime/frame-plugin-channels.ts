import { createHostChannelRateLimiter, HISTOIRE_PLUGIN_CHANNEL_MAX_BYTES, HISTOIRE_PLUGIN_NOTICE_PREFIX } from '@histoire/protocol'

/**
 * Emits the frame side of plugin channels: one channel per plugin attachment, runtime notices
 * (`histoire:attached`, `histoire:detached`, `histoire:error`) and inbound delivery by actor id.
 *
 * Plugin traffic travels as `HOST_CHANNEL_MESSAGE` with a `plugin` body, so it inherits the
 * sandbox source/origin/document guards of both ends, but it never uses channel names nor the
 * selected variant: the host addresses one actor.
 *
 * Rate windows reuse the protocol limiter (inlined, the runtime cannot import protocol) per
 * plugin and direction, shared by every actor of this document. Limits are baked from protocol.
 *
 * Needs from earlier sections: `postToParent` (host messaging), `measureWireValue`,
 * `HOST_CHANNEL_MESSAGE` (preamble), and `frameActorSlots` (frame actors, hoisted access only).
 */
export function previewFramePluginChannels() {
  return `const PLUGIN_CHANNEL_MAX_BYTES = ${HISTOIRE_PLUGIN_CHANNEL_MAX_BYTES}
const PLUGIN_NOTICE_PREFIX = ${JSON.stringify(HISTOIRE_PLUGIN_NOTICE_PREFIX)}
const createFramePluginRateLimiter = ${createHostChannelRateLimiter.toString()}
/** Rate windows and drop counts per plugin; this document's actors share them. */
const framePluginRates = new Map()

/** Limiter pair of one loaded plugin. */
function getFramePluginRates(pluginId) {
  let rates = framePluginRates.get(pluginId)
  if (!rates) framePluginRates.set(pluginId, rates = { incoming: createFramePluginRateLimiter(), outgoing: createFramePluginRateLimiter() })
  return rates
}

/** Coded failure, mapped by hosts like other runtime request errors. */
function framePluginFailure(code, message) {
  return Object.assign(new Error(message), { code })
}

/** Plugin message body: plugin-chosen non-reserved type and bounded JSON data. */
function checkFramePluginMessage(type, data) {
  if (typeof type !== 'string' || !type || type.length > 4096 || type.startsWith(PLUGIN_NOTICE_PREFIX)) throw framePluginFailure('INVALID_ARGUMENT', 'Invalid plugin message type')
  if (data === undefined) throw framePluginFailure('INVALID_ARGUMENT', 'Plugin message needs data')
  measureWireValue(data, { maxBytes: PLUGIN_CHANNEL_MAX_BYTES })
}

/** Posts one plugin body of \`actor\` to the host, attributed to the variant it renders. */
function postFramePluginBody(pluginId, actorId, target, type, data) {
  postToParent({ type: HOST_CHANNEL_MESSAGE, storyId: target.storyId, variantId: target.variantId, plugin: { pluginId, actorId, type, data } })
}

/**
 * Channel of one attachment. Listeners live on the attachment and are dropped when it stops;
 * posts after detach reject. Nothing is queued or replayed.
 */
function createFramePluginChannel(attachment) {
  const rates = getFramePluginRates(attachment.pluginId)
  return Object.freeze({
    post(type, data) {
      const operation = Promise.resolve().then(() => {
        if (attachment.controller.signal.aborted) throw framePluginFailure('RUNTIME_CHANGED', 'Plugin actor detached')
        try {
          checkFramePluginMessage(type, data)
        }
        catch (error) {
          rates.outgoing.drop()
          throw error
        }
        if (!rates.outgoing.accept()) throw framePluginFailure('RATE_LIMITED', 'Plugin channel rate limit exceeded')
        postFramePluginBody(attachment.pluginId, attachment.actorId, attachment.target, type, structuredClone(data))
      })
      // Plugins that ignore the promise must not produce unhandled rejections.
      void operation.catch(() => {})
      return operation
    },
    on(type, listener) {
      if (typeof type !== 'string' || !type || type.startsWith(PLUGIN_NOTICE_PREFIX) || typeof listener !== 'function') throw framePluginFailure('INVALID_ARGUMENT', 'Invalid plugin channel listener')
      if (attachment.controller.signal.aborted) return () => {}
      const entry = { type, listener }
      attachment.listeners.add(entry)
      return () => attachment.listeners.delete(entry)
    },
    getDroppedCount: () => Math.min(Number.MAX_SAFE_INTEGER, rates.incoming.droppedCount + rates.outgoing.droppedCount),
  })
}

/** Live attachment of \`pluginId\` on the attached actor \`actorId\`, or the reason it is missing. */
function findFramePluginAttachment(actorId, pluginId) {
  for (const slot of frameActorSlots) {
    if (slot.actor.id !== actorId || slot.actor.status !== 'attached') continue
    const attachment = slot.actor.attachments.find(item => item.pluginId === pluginId && item.announced && !item.controller.signal.aborted)
    return attachment ?? 'CAPABILITY_UNAVAILABLE'
  }
  return 'RUNTIME_CHANGED'
}

/**
 * Delivers one host message to the listeners of exactly one actor attachment. Throws a coded
 * failure (counted against the plugin when it is loaded here) for anything else.
 */
function receiveFramePluginMessage(payload) {
  const fields = payload && typeof payload === 'object' ? Object.keys(payload) : []
  const rates = typeof payload?.pluginId === 'string' ? framePluginRates.get(payload.pluginId) : undefined
  try {
    if (fields.length !== 4 || !['pluginId', 'actorId', 'type', 'data'].every(key => fields.includes(key)) || typeof payload.actorId !== 'string') throw framePluginFailure('INVALID_ARGUMENT', 'Invalid plugin channel payload')
    checkFramePluginMessage(payload.type, payload.data)
  }
  catch (error) {
    rates?.incoming.drop()
    throw error
  }
  const attachment = findFramePluginAttachment(payload.actorId, payload.pluginId)
  if (typeof attachment === 'string') {
    rates?.incoming.drop()
    throw framePluginFailure(attachment, attachment === 'RUNTIME_CHANGED' ? 'Plugin actor is not attached' : 'Plugin is not attached to this actor')
  }
  if (!rates.incoming.accept()) throw framePluginFailure('RATE_LIMITED', 'Plugin channel rate limit exceeded')
  const message = { pluginId: payload.pluginId, actorId: payload.actorId, target: { ...attachment.target }, type: payload.type, data: payload.data }
  // Rejected listener promises are observed; they charge the plugin only while attached.
  const failed = () => {
    if (!attachment.controller.signal.aborted) rates.incoming.drop()
  }
  for (const entry of [...attachment.listeners]) {
    if (entry.type !== payload.type) continue
    try {
      void Promise.resolve(entry.listener(structuredClone(message.data), structuredClone(message))).catch(failed)
    }
    catch { failed() }
  }
}`
}
