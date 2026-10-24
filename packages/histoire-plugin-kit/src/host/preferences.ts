import type { HistoireJsonValue } from '@histoire/protocol'
import type { Disposer } from '../types/common.js'
import type { PluginPreferences, StorageLike } from '../types/preferences.js'

/** Listener of one fully namespaced preference key; never throws (errors are attributed). */
type PreferenceListener = (value: HistoireJsonValue) => void

/**
 * Host-wide preference backend over injected storage. A per-host memory overlay holds
 * values when storage is absent or a write fails, so reads stay consistent and two hosts
 * without storage never see each other's values.
 */
export interface PreferenceStore {
  /** Raw value of a full key, or `null`. */
  read: (key: string) => string | null
  /** Writes a raw value of a full key. */
  write: (key: string, raw: string) => void
  /** Listeners by full key. */
  readonly listeners: Map<string, Set<PreferenceListener>>
  /** Host-level notification after any write (toolbar toggles and badges re-read plugin state). */
  readonly changed: () => void
}

/** Options of {@link createPreferenceStore}. */
export interface PreferenceStoreOptions {
  /** Project namespace; external changes outside `<namespace>:plugin:` are ignored. */
  namespace?: string
  /** Host lifetime; the storage change subscription is released when it aborts. */
  signal?: AbortSignal
}

/**
 * Key prefix shared by every plugin preference of one project namespace.
 * @param namespace Project namespace, if any.
 */
function preferencePrefix(namespace: string | undefined): string {
  return `${namespace ? `${namespace}:` : ''}plugin:`
}

/**
 * Creates the preference backend of one host.
 * @param storage Injected storage; memory only when absent.
 * @param changed Called after every write, after key subscribers.
 * @param options Namespace and lifetime used to observe changes made outside this host.
 */
export function createPreferenceStore(storage: StorageLike | undefined, changed: () => void = () => {}, options: PreferenceStoreOptions = {}): PreferenceStore {
  const memory = new Map<string, string>()
  const listeners = new Map<string, Set<PreferenceListener>>()
  const prefix = preferencePrefix(options.namespace)

  /**
   * Reads a raw value, the memory overlay first.
   * @param key Full key.
   */
  function read(key: string): string | null {
    if (memory.has(key)) return memory.get(key)!
    try {
      return storage?.getItem(key) ?? null
    }
    catch {
      return null
    }
  }

  /**
   * Applies a change made outside this host (another tab): key subscribers receive the stored
   * value, then host subscribers re-read. Removed or unreadable values only notify the host,
   * since subscribers cannot know the fallback their `get` would use.
   * @param key Changed full key, or `null` when the whole storage was cleared.
   */
  function external(key: string | null): void {
    if (key !== null && !key.startsWith(prefix)) return
    // The other writer's value supersedes values this host could not persist.
    if (key === null) memory.clear()
    else memory.delete(key)
    for (const fullKey of key === null ? [...listeners.keys()] : [key]) {
      const raw = read(fullKey)
      if (raw === null) continue
      let value: HistoireJsonValue
      try {
        value = JSON.parse(raw)
      }
      catch {
        continue
      }
      for (const listener of [...listeners.get(fullKey) ?? []]) listener(value)
    }
    changed()
  }

  const { signal } = options
  if (storage?.subscribe && signal && !signal.aborted) {
    const stop = storage.subscribe(external)
    signal.addEventListener('abort', () => stop(), { once: true })
  }

  return {
    read,
    write(key, raw) {
      try {
        if (!storage) throw new Error('no storage')
        storage.setItem(key, raw)
        memory.delete(key)
      }
      catch {
        // Unavailable or full storage: keep the value for this host's lifetime.
        memory.set(key, raw)
      }
    },
    listeners,
    changed,
  }
}

/** Inputs of one plugin's preferences. */
export interface PluginPreferencesOptions {
  /** Host preference backend. */
  store: PreferenceStore
  /** Owning plugin. */
  pluginId: string
  /** Project namespace prepended to every key. */
  namespace: string | undefined
  /** Whether the plugin generation is still current; writes from stale generations are dropped. */
  isActive: () => boolean
  /** Ties a subscription to the plugin lifetime. */
  track: (release: () => void) => Disposer
  /** Receives listener errors. */
  onError: (error: unknown) => void
}

/**
 * Creates `api.preferences` for one plugin: JSON values under `plugin:<id>:`, optionally
 * prefixed by the project namespace.
 * @param options Backend, ownership and attribution.
 */
export function createPluginPreferences(options: PluginPreferencesOptions): PluginPreferences {
  const { store, pluginId, namespace, isActive, track, onError } = options
  const prefix = `${preferencePrefix(namespace)}${pluginId}:`

  return {
    get(key, fallback) {
      const raw = store.read(prefix + key)
      if (raw === null) return fallback
      try {
        return JSON.parse(raw)
      }
      catch {
        return fallback
      }
    },
    set(key, value) {
      if (!isActive()) return
      const fullKey = prefix + key
      store.write(fullKey, JSON.stringify(value))
      for (const listener of [...store.listeners.get(fullKey) ?? []]) listener(value)
      store.changed()
    },
    subscribe(key, listener) {
      const fullKey = prefix + key
      let listeners = store.listeners.get(fullKey)
      if (!listeners) store.listeners.set(fullKey, listeners = new Set())
      // Wrapper keeps duplicate subscriptions of the same function independent and attributes
      // failures to this plugin, whichever host or tab wrote the value.
      const entry: PreferenceListener = (value) => {
        try {
          listener(value)
        }
        catch (error) {
          onError(error)
        }
      }
      listeners.add(entry)
      return track(() => {
        listeners.delete(entry)
        if (!listeners.size && store.listeners.get(fullKey) === listeners) store.listeners.delete(fullKey)
      })
    },
  }
}
