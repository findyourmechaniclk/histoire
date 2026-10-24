import type { HistoireJsonValue } from '@histoire/protocol'
import type { Disposer } from './common.js'

/**
 * Plugin-scoped JSON preferences. Standalone persists under a plugin and project namespace;
 * embedded hosts persist only when they inject storage. Never saved to project config.
 */
export interface PluginPreferences {
  /** Reads a stored value, or `fallback` when absent or unreadable. */
  get: <T extends HistoireJsonValue>(key: string, fallback: T) => T
  /** Stores a JSON value and notifies subscribers of `key`. */
  set: (key: string, value: HistoireJsonValue) => void
  /** Observes changes to one key. */
  subscribe: (key: string, listener: (value: HistoireJsonValue) => void) => Disposer
}

/** Minimal synchronous storage injected by hosts (compatible with `window.localStorage`). */
export interface StorageLike {
  /** Reads a raw string value or `null`. */
  getItem: (key: string) => string | null
  /** Writes a raw string value. */
  setItem: (key: string, value: string) => void
  /** Removes a value. */
  removeItem: (key: string) => void
  /**
   * Optional: observes changes made outside this host (another tab or window), like the
   * `storage` event. `key` is the changed key, or `null` when the storage was cleared. Without
   * it, preference subscribers only see writes of their own host.
   * @returns Stops observing; called when the host is disposed.
   */
  subscribe?: (listener: (key: string | null) => void) => Disposer
}
