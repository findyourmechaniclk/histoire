import type { HistoireJsonValue, HistoireTarget } from '@histoire/protocol'
import type { Disposer } from './common.js'

/** Message received on a plugin channel, attributed to its sender. */
export interface PluginChannelMessage {
  /** Plugin owning the channel. */
  pluginId: string
  /** Frame actor that sent or receives the message. */
  actorId: string
  /** Variant rendered by the actor. */
  target: HistoireTarget
  /** Message type chosen by the plugin. */
  type: string
  /** JSON payload. */
  data: HistoireJsonValue
}

/**
 * Per-plugin channel bound to exactly one frame actor.
 * Size and rate limits follow host channels; excess messages are dropped and counted.
 */
export interface PluginChannel {
  /** Sends one message; resolves when handed to the transport. */
  post: (type: string, data: HistoireJsonValue) => Promise<void>
  /** Observes messages of one type. */
  on: (type: string, listener: (data: HistoireJsonValue, message: PluginChannelMessage) => void) => Disposer
  /** Messages dropped by limits since the channel opened. */
  getDroppedCount: () => number
}
