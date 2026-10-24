import type { DevEventService, WorkbenchSource } from '@histoire/plugin-kit'
import { HistoireSdkError } from '@histoire/protocol'

/** Inputs deciding whether the dev event service exists. */
export interface DevEventServiceOptions {
  /** Story source mode; only live dev sources reach the Node `onDevEvent` hook. */
  mode: WorkbenchSource['mode']
  /** Whether a Vite HMR transport is present (`import.meta.hot`). */
  hot: boolean
  /** Window holding the established `__HST_PLUGIN_API__` global. */
  window: Window
}

/**
 * Creates the plugin dev event service, or `undefined` for static books, remote sources and
 * builds without an HMR transport (the capability is then reported unavailable).
 * Events travel through the existing `window.__HST_PLUGIN_API__.sendEvent` path, read at call
 * time because the global is installed after the workbench mounts.
 * @param options Source mode, transport presence and owning window.
 */
export function resolveDevEventService(options: DevEventServiceOptions): DevEventService | undefined {
  if (options.mode !== 'dev' || !options.hot) return undefined
  const { window } = options
  return Object.freeze({
    send(event: string, payload?: unknown): Promise<unknown> {
      const api = window.__HST_PLUGIN_API__
      if (!api) return Promise.reject(new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Histoire dev event API is not installed'))
      return api.sendEvent(event, payload)
    },
  })
}
