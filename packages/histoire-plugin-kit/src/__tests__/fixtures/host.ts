/**
 * Shared lifecycle fixtures for extension host tests: a controllable root context,
 * in-memory storage, deferred promises and plugin/host factories.
 */
import type { CatalogService, ExtensionHost, ExtensionHostPlugin, ExtensionHostServices, NavigationService, StorageLike, WorkbenchContext, WorkbenchPluginApi, WorkbenchPluginDefinition, WorkbenchSource } from '../../index.js'
import { createExtensionHost, defineWorkbenchPlugin } from '../../index.js'

/** Root context whose `source` and change notifications tests can drive. */
export interface TestContext extends WorkbenchContext {
  /** Story source mode; mutable so tests can switch between dev and static. */
  source: { mode: WorkbenchSource['mode'] }
  /** Notifies context subscribers, as a selection or source change would. */
  notify: () => void
  /** Number of active subscriptions, to prove hosts release theirs. */
  readonly listenerCount: number
}

/** Creates a root context with inert services and observable subscriptions. */
export function createTestContext(): TestContext {
  const listeners = new Set<() => void>()
  return {
    capabilities: new Set(),
    source: { mode: 'dev' },
    catalog: {} as CatalogService,
    selection: { target: null },
    navigation: {} as NavigationService,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    notify() {
      for (const listener of [...listeners]) listener()
    },
    get listenerCount() {
      return listeners.size
    },
  }
}

/** `StorageLike` over a plain map, exposing raw entries for assertions. */
export function createMemoryStorage(): StorageLike & { entries: Map<string, string> } {
  const entries = new Map<string, string>()
  return {
    entries,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: key => void entries.delete(key),
  }
}

/** Memory storage with a change subscription, like a browser tab observing `storage` events. */
export interface ObservableTestStorage extends ReturnType<typeof createMemoryStorage> {
  /** Live change subscriptions, to prove hosts release theirs. */
  listeners: Set<(key: string | null) => void>
  /** Observes changes made outside the host. */
  subscribe: (listener: (key: string | null) => void) => () => void
  /** Writes (or removes, with `null`) a raw value as another tab would, then reports it. */
  external: (key: string, value: string | null) => void
}

/** Creates an {@link ObservableTestStorage}. */
export function createObservableStorage(): ObservableTestStorage {
  const listeners = new Set<(key: string | null) => void>()
  const storage = createMemoryStorage()
  return Object.assign(storage, {
    listeners,
    subscribe(listener: (key: string | null) => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    external(key: string, value: string | null) {
      if (value === null) storage.entries.delete(key)
      else storage.entries.set(key, value)
      for (const listener of [...listeners]) listener(key)
    },
  })
}

/** Promise with externally controlled settlement. */
export interface Deferred<T> {
  /** Underlying promise. */
  promise: Promise<T>
  /** Fulfils the promise. */
  resolve: (value: T) => void
  /** Rejects the promise. */
  reject: (error: unknown) => void
}

/** Creates a {@link Deferred}. */
export function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * Defines a valid workbench plugin with the given setup.
 * @param id Plugin id.
 * @param setup Setup hook under test.
 */
export function plugin(id: string, setup: WorkbenchPluginDefinition['setup']): WorkbenchPluginDefinition {
  return defineWorkbenchPlugin({ id, apiVersion: 1, setup })
}

/**
 * Plugin registering one command per local id during setup.
 * @param id Plugin id.
 * @param commandIds Local command ids, registered in order.
 * @param extra Optional fields merged into every command.
 * @param extra.order Sort key of every command.
 */
export function commandPlugin(id: string, commandIds: string[], extra: { order?: number } = {}): WorkbenchPluginDefinition {
  return plugin(id, (api) => {
    for (const commandId of commandIds) addCommand(api, commandId, extra)
  })
}

/**
 * Registers an inert command through the plugin API.
 * @param api Plugin API.
 * @param id Local command id.
 * @param extra Optional fields merged into the command.
 */
export function addCommand(api: WorkbenchPluginApi, id: string, extra: Partial<Parameters<WorkbenchPluginApi['commands']['add']>[0]> = {}): () => void {
  return api.commands.add({ id, label: id, icon: 'play', run: () => {}, ...extra })
}

/**
 * Creates a host over a fresh test context unless services are given.
 * @param plugins Plugins in config order.
 * @param services Overrides merged over the default services.
 */
export function createTestHost(plugins: ExtensionHostPlugin[], services: Partial<ExtensionHostServices> = {}): ExtensionHost & { context: TestContext } {
  const context = (services.context as TestContext | undefined) ?? createTestContext()
  const host = createExtensionHost({ plugins, services: { ...services, context } })
  return Object.assign(host, { context })
}

/**
 * Qualified ids of the committed contributions of one kind, in order.
 * @param host Host under test.
 * @param kind Contribution kind; defaults to commands.
 */
export function ids(host: ExtensionHost, kind: 'command' | 'inspector.tab' = 'command'): string[] {
  return host.contributions(kind).map(entry => entry.id)
}
