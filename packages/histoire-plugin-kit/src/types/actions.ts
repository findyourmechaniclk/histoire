import type { Awaitable } from './common.js'

/** Per-invocation options passed to an action. */
export interface ActionRunOptions {
  /** Aborted when the captured target scope changes (selection or source); late results are discarded. */
  signal: AbortSignal
}

/**
 * Plugin action. The host captures the target scope when invocation starts,
 * so `context` keeps describing the invoked target even if selection moves.
 */
export type ActionRun<C> = (context: C, options: ActionRunOptions) => Awaitable<void>
