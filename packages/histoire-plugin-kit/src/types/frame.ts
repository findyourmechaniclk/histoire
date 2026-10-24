import type { HistoireJsonValue, HistoireTarget } from '@histoire/protocol'
import type { PluginChannel } from './channel.js'
import type { Awaitable, Disposer } from './common.js'

/** Readonly view of the rendered variant's state inside the frame. */
export interface ReadonlyFrameState {
  /** Current variant state. */
  readonly value: Readonly<Record<string, unknown>>
  /** Notified after state changes. */
  subscribe: (listener: () => void) => Disposer
}

/** Context passed to a frame plugin for one rendered actor. */
export interface FramePluginContext {
  /** Unique id of this rendered mount. */
  readonly actorId: string
  /** Id of the frame document hosting the actor. */
  readonly documentId: string
  /** Rendered variant. */
  readonly target: HistoireTarget
  /** Rendered variant root element. */
  readonly element: HTMLElement
  /** Aborted when the actor is torn down (selection, HMR, page hide). */
  readonly signal: AbortSignal
  /** Variant state. */
  readonly state: ReadonlyFrameState
  /** Browser-visible options from the plugin descriptor. */
  readonly options: HistoireJsonValue | undefined
  /** Channel to the workbench side of this plugin, bound to this actor. */
  readonly channel: PluginChannel
  /** Registers teardown run when the actor detaches. */
  onCleanup: (callback: () => void) => void
}

/** Shape accepted by `defineFramePlugin`. */
export interface FramePluginDefinition {
  /** Plugin id; must match the descriptor id. */
  readonly id: string
  /** Extension contract version; only `1` exists. */
  readonly apiVersion: 1
  /** Called once per rendered actor after variant readiness; the returned disposer runs on detach. */
  readonly attach: (frame: FramePluginContext) => Awaitable<void | Disposer>
}
