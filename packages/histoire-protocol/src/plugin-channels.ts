import type { HistoireJsonValue, HistoireTarget } from './types/common.js'
import { measureWireValue } from './bridge/size.js'
import { invalid, validateHistoireTarget, wireId, wireRecord } from './bridge/validation.js'
import { createHostChannelRateLimiter } from './channels.js'

/** Byte budget of one plugin message, same as named host channels. */
export const HISTOIRE_PLUGIN_CHANNEL_MAX_BYTES = 64 * 1024

/** Plugin id grammar shared with `@histoire/plugin-kit` descriptors; `builtin` is reserved. */
export const HISTOIRE_PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]*$/

/** Message types under this prefix are runtime notices; plugins can neither send nor observe them. */
export const HISTOIRE_PLUGIN_NOTICE_PREFIX = 'histoire:'

/** Frame runtime notices: actor attached after `attach` settled, actor detached, plugin failure. */
export const HISTOIRE_PLUGIN_NOTICES = ['histoire:attached', 'histoire:detached', 'histoire:error'] as const

/** One runtime notice type. */
export type HistoirePluginNotice = typeof HISTOIRE_PLUGIN_NOTICES[number]

/** Wire body of one plugin message; never carries a host channel name. */
export interface HistoirePluginChannelPayload {
  /** Plugin owning both ends of the channel. */
  pluginId: string
  /** Exact frame actor the message comes from or goes to. */
  actorId: string
  /** Plugin-chosen message discriminator. */
  type: string
  /** Bounded JSON. */
  data: HistoireJsonValue
}

/** Message as listeners receive it, attributed to the actor's rendered variant. */
export interface HistoirePluginChannelMessage extends HistoirePluginChannelPayload {
  /** Variant rendered by the actor. */
  target: HistoireTarget
}

/** `plugin.message` publication: message plus the runtime document hosting the actor. */
export interface HistoirePluginChannelEvent extends HistoirePluginChannelMessage {
  /** Runtime document identity. */
  runtimeId: string
}

/** Per-plugin channel bound to exactly one frame actor (structurally equal to plugin-kit `PluginChannel`). */
export interface HistoirePluginChannel {
  /** Sends one message to the bound actor; rejects once the actor retired. */
  post: (type: string, data: HistoireJsonValue) => Promise<void>
  /** Observes messages of one type from the bound actor; returns unsubscribe. */
  on: (type: string, listener: (data: HistoireJsonValue, message: HistoirePluginChannelMessage) => void) => () => void
  /** Messages of this plugin dropped by validation, rate or listener failure. */
  getDroppedCount: () => number
}

/** Installed frame plugin as advertised by a source descriptor; data only. */
export interface HistoireFramePluginInfo {
  /** Plugin id. */
  id: string
  /** Frame contract version. */
  apiVersion: number
}

/** Whether `type` names a runtime notice rather than plugin data. */
export function isHistoirePluginNotice(type: string): type is HistoirePluginNotice {
  return type.startsWith(HISTOIRE_PLUGIN_NOTICE_PREFIX)
}

/** Validates a plugin id against the shared grammar. */
export function isHistoirePluginId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && value !== 'builtin' && HISTOIRE_PLUGIN_ID_PATTERN.test(value)
}

/** Notice bodies are fixed: attach/detach carry nothing, failures a phase and bounded message. */
function validateNotice(type: string, data: unknown): void {
  if (!(HISTOIRE_PLUGIN_NOTICES as readonly string[]).includes(type)) invalid('Unknown plugin notice')
  if (type !== 'histoire:error') {
    if (data !== null) invalid('Plugin notice carries no data')
    return
  }
  const error = wireRecord(data)
  if (Object.keys(error).some(key => key !== 'phase' && key !== 'message') || typeof error.phase !== 'string' || error.phase.length > 64 || typeof error.message !== 'string' || error.message.length > 2000) invalid('Invalid plugin failure notice')
}

/**
 * Validates one plugin message in a single bounded traversal.
 * @param value Untrusted payload.
 * @param attributed Frame-to-host publication: requires `target` and `runtimeId`.
 * @param notices Admits runtime notices; only frame-to-host traffic carries them.
 */
export function validatePluginChannelPayload(value: unknown, attributed = false, notices = attributed): HistoirePluginChannelPayload {
  measureWireValue(value, { maxBytes: HISTOIRE_PLUGIN_CHANNEL_MAX_BYTES })
  const input = wireRecord(value)
  const fields = attributed ? ['pluginId', 'actorId', 'type', 'data', 'target', 'runtimeId'] : ['pluginId', 'actorId', 'type', 'data']
  if (Object.keys(input).some(key => !fields.includes(key)) || !Object.hasOwn(input, 'data') || input.data === undefined) invalid('Invalid plugin channel payload')
  if (!isHistoirePluginId(input.pluginId) || !wireId(input.actorId) || !wireId(input.type)) invalid('Invalid plugin channel identity')
  if (isHistoirePluginNotice(input.type as string)) {
    if (!notices) invalid('Plugin message type is reserved')
    validateNotice(input.type as string, input.data)
  }
  if (attributed) {
    if (!wireId(input.runtimeId)) invalid('Invalid plugin channel runtime')
    validateHistoireTarget(input.target)
    if ((input.target as HistoireTarget).variantId === null) invalid('Plugin channel needs a variant')
  }
  return input as unknown as HistoirePluginChannelPayload
}

/**
 * Validates the descriptor inventory of installed frame plugins: unique ids, integer versions,
 * nothing but `{ id, apiVersion }` (never module paths).
 */
export function validateFramePluginInventory(value: unknown): HistoireFramePluginInfo[] {
  if (!Array.isArray(value) || value.length > 256) return invalid('Invalid frame plugin inventory')
  const seen = new Set<string>()
  for (const entry of value) {
    const plugin = wireRecord(entry)
    if (Object.keys(plugin).some(key => key !== 'id' && key !== 'apiVersion') || !isHistoirePluginId(plugin.id) || seen.has(plugin.id)
      || !Number.isSafeInteger(plugin.apiVersion) || (plugin.apiVersion as number) < 1) {
      invalid('Invalid frame plugin entry')
    }
    seen.add(plugin.id as string)
  }
  return value as HistoireFramePluginInfo[]
}

/**
 * Rate windows per plugin and direction, reusing the host-channel limiter: one plugin saturating
 * its window never charges another. Owners create one per runtime document.
 * @param now Clock, injectable for tests.
 */
export function createPluginChannelLimiters(now: () => number = Date.now) {
  const plugins = new Map<string, { incoming: ReturnType<typeof createHostChannelRateLimiter>, outgoing: ReturnType<typeof createHostChannelRateLimiter> }>()
  return {
    /** Limiter pair of one plugin, created on first use. */
    get(pluginId: string) {
      let limiters = plugins.get(pluginId)
      if (!limiters) {
        limiters = { incoming: createHostChannelRateLimiter(now), outgoing: createHostChannelRateLimiter(now) }
        plugins.set(pluginId, limiters)
      }
      return limiters
    },
    /** Saturated drop count of one plugin across both directions. */
    droppedCount(pluginId: string): number {
      const limiters = plugins.get(pluginId)
      return limiters ? Math.min(Number.MAX_SAFE_INTEGER, limiters.incoming.droppedCount + limiters.outgoing.droppedCount) : 0
    },
    /** Replacement documents never inherit rate tokens or counts. */
    reset() {
      plugins.clear()
    },
  }
}

/** Per-plugin limiter set of one runtime document. */
export type HistoirePluginChannelLimiters = ReturnType<typeof createPluginChannelLimiters>
