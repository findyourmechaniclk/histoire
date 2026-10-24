import type { HistoireJsonValue } from '@histoire/protocol'
import type { Disposer } from '../types/common.js'
import type { WorkbenchContext } from '../types/context.js'
import type { WorkbenchContribution } from '../types/contribution.js'
import type { WorkbenchPluginDefinition } from '../types/plugin.js'
import type { DiagnosticsLog } from './diagnostics.js'
import type { Scope } from './generation.js'
import type { PreferenceStore } from './preferences.js'
import type { Registry, RegistryEntry } from './registry.js'
import { PluginDefinitionError } from '../errors.js'
import { qualifyId } from '../ids.js'
import { createPluginApi } from './plugin-api.js'
import { createPluginPreferences } from './preferences.js'
import { assertKnownKind, qualifyContribution } from './registry.js'
import { createResourceSet, NOOP } from './resources.js'

/** Host state shared by every installed plugin. */
export interface HostInternals {
  /** Contribution registry. */
  registry: Registry
  /** Diagnostics log. */
  diagnostics: DiagnosticsLog
  /** Host scope; plugin scopes are its children. */
  scope: Scope
  /** Root context. */
  context: WorkbenchContext
  /** Preference backend. */
  preferences: PreferenceStore
  /** Project namespace of preference keys. */
  storageNamespace: string | undefined
  /** Next host-wide registration sequence number. */
  nextSequence: () => number
  /** Notifies host subscribers (`api.invalidate`). */
  notify: () => void
}

/** One plugin installed into a host. */
export interface InstalledPlugin {
  /** Settles once setup committed, failed or the plugin was disposed. */
  readonly settled: Promise<void>
  /** Retires the plugin and releases everything it owns, exactly once. */
  dispose: () => void
}

/**
 * Resolves when `signal` aborts, so a hanging setup cannot hold `ready` after disposal.
 * @param signal Plugin scope signal.
 */
function whenAborted(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => signal.aborted ? resolve() : signal.addEventListener('abort', () => resolve(), { once: true }))
}

/**
 * Installs one validated plugin: runs `setup` against a provisional batch, commits the
 * batch atomically on success and rolls everything back on failure.
 * @param definition Validated definition.
 * @param options Browser-visible options.
 * @param configIndex Position in config, used for ordering.
 * @param host Shared host state.
 */
export function installPlugin(definition: WorkbenchPluginDefinition, options: HistoireJsonValue | undefined, configIndex: number, host: HostInternals): InstalledPlugin {
  const pluginId = definition.id
  // Plugin generation: retired on failure, plugin disposal or host disposal.
  const scope = host.scope.child()
  const resources = createResourceSet(error => host.diagnostics.record({ pluginId, phase: 'dispose', error }))
  /** Registrations made while setup is pending; `null` once committed or rolled back. */
  let pending: RegistryEntry[] | null = []
  /** Qualified ids owned by this plugin, pending or committed, for duplicate checks. */
  const owned = new Set<string>()
  /** Qualified ids exposed in the registry. */
  const committed = new Set<string>()
  let tornDown = false

  /**
   * Validates and builds a registry entry; records and rethrows rejections.
   * @param contribution Untrusted contribution.
   */
  function createEntry(contribution: WorkbenchContribution): RegistryEntry {
    try {
      assertKnownKind(contribution, pluginId)
      const id = qualifyId(pluginId, contribution.id)
      // Duplicates reject before anything is exposed and never replace the first entry.
      if (owned.has(id)) throw new PluginDefinitionError(`duplicate contribution id "${id}"`, pluginId)
      const order = typeof contribution.order === 'number' && Number.isFinite(contribution.order) ? contribution.order : 0
      return {
        contribution: qualifyContribution(contribution, pluginId, id),
        rank: { builtin: false, order, configIndex, sequence: host.nextSequence() },
        owner: scope.signal,
      }
    }
    catch (error) {
      host.diagnostics.record({ pluginId, phase: 'register', error })
      throw error
    }
  }

  /**
   * Owned registration: provisional while setup is pending, direct afterwards.
   * Stale generations get a no-op disposer and never reach the registry.
   * @param contribution Contribution from the plugin.
   */
  function contribute(contribution: WorkbenchContribution): Disposer {
    if (!scope.active) return NOOP
    const entry = createEntry(contribution)
    const id = entry.contribution.id
    owned.add(id)
    if (pending) {
      pending.push(entry)
    }
    else {
      committed.add(id)
      host.registry.commit([entry])
    }
    let released = false
    return () => {
      // `released` keeps a stale disposer from removing a re-registered id; `owned` is
      // cleared on teardown, which turns late disposers into no-ops.
      if (released) return
      released = true
      if (!owned.delete(id)) return
      if (pending) pending = pending.filter(candidate => candidate !== entry)
      else if (committed.delete(id)) host.registry.remove([id])
    }
  }

  /** Retires the generation and releases resources, then exposed entries; runs once. */
  function teardown(): void {
    if (tornDown) return
    tornDown = true
    scope.retire()
    pending = null
    resources.close()
    const exposed = [...committed]
    committed.clear()
    owned.clear()
    host.registry.remove(exposed)
  }

  /**
   * Rolls back a failed setup.
   * @param error Setup error.
   */
  function fail(error: unknown): void {
    host.diagnostics.record({ pluginId, phase: 'setup', error })
    teardown()
  }

  /**
   * Commits the provisional batch. A disposer returned after retirement runs immediately.
   * @param result Setup return value.
   */
  function commit(result: void | Disposer): void {
    if (typeof result === 'function') resources.add(result)
    if (!scope.active || !pending) return
    const batch = pending
    pending = null
    for (const entry of batch) committed.add(entry.contribution.id)
    host.registry.commit(batch)
  }

  const api = createPluginApi({
    id: pluginId,
    options,
    context: host.context,
    signal: scope.signal,
    contribute,
    track: release => resources.add(release),
    reportError: (error) => {
      if (scope.active) host.diagnostics.record({ pluginId, phase: 'report', error })
    },
    invalidate: () => {
      if (scope.active) host.notify()
    },
    preferences: createPluginPreferences({
      store: host.preferences,
      pluginId,
      namespace: host.storageNamespace,
      isActive: () => scope.active,
      track: release => resources.add(release),
      onError: error => host.diagnostics.record({ pluginId, phase: 'callback', error }),
    }),
  })

  /** Runs setup; synchronous throws and rejections both roll back. */
  function start(): Promise<void> {
    let result: ReturnType<WorkbenchPluginDefinition['setup']>
    try {
      result = definition.setup(api)
    }
    catch (error) {
      fail(error)
      return Promise.resolve()
    }
    const completion = Promise.resolve(result).then(commit, (error: unknown) => {
      // Rejections of a retired generation are discarded.
      if (scope.active) fail(error)
    })
    return Promise.race([completion, whenAborted(scope.signal)])
  }

  return { settled: start(), dispose: teardown }
}
