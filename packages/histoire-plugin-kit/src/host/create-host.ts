import type { HistoireJsonValue } from '@histoire/protocol'
import type { Disposer } from '../types/common.js'
import type { WorkbenchContext } from '../types/context.js'
import type { QualifiedContribution, WorkbenchContribution } from '../types/contribution.js'
import type { ExtensionHost, ExtensionHostOptions, ExtensionHostPlugin } from '../types/host.js'
import type { WorkbenchPluginDefinition } from '../types/plugin.js'
import type { HostInternals, InstalledPlugin } from './install.js'
import { defineWorkbenchPlugin } from '../define.js'
import { PluginDefinitionError } from '../errors.js'
import { BUILTIN_NAMESPACE, parseQualifiedId } from '../ids.js'
import { resolveRunnable, runAction } from './actions.js'
import { createDiagnosticsLog } from './diagnostics.js'
import { createScope } from './generation.js'
import { installPlugin } from './install.js'
import { mountContribution } from './mount.js'
import { createPreferenceStore } from './preferences.js'
import { assertKnownKind, createRegistry, qualifyContribution } from './registry.js'
import { NOOP } from './resources.js'

/**
 * Splits a config entry into definition and options.
 * @param entry Bare definition or `{ definition, options }`.
 */
function normalizeEntry(entry: ExtensionHostPlugin): { definition: WorkbenchPluginDefinition, options: HistoireJsonValue | undefined } {
  return typeof entry === 'object' && entry !== null && 'definition' in entry
    ? { definition: entry.definition, options: entry.options }
    : { definition: entry, options: undefined }
}

/**
 * Best-effort plugin attribution for an invalid definition.
 * @param error Validation error.
 * @param definition Untrusted definition.
 */
function attributedId(error: unknown, definition: unknown): string {
  if (error instanceof PluginDefinitionError && error.pluginId !== undefined) return error.pluginId
  const id = typeof definition === 'object' && definition !== null ? (definition as { id?: unknown }).id : undefined
  return typeof id === 'string' ? id : '<unknown>'
}

/**
 * Creates the per-workbench extension host: installs plugins concurrently in config order,
 * owns the registry, preferences and diagnostics, and tears everything down exactly once.
 * Hosts never share state, even when created from the same definitions.
 * @param options Plugins in config order and host services.
 */
export function createExtensionHost(options: ExtensionHostOptions): ExtensionHost {
  const { services } = options
  const listeners = new Set<() => void>()

  /** Notifies host subscribers; a throwing listener never blocks the others. */
  function notify(): void {
    for (const listener of [...listeners]) {
      try {
        listener()
      }
      catch (error) {
        queueMicrotask(() => {
          throw error
        })
      }
    }
  }

  // Host generation: every plugin, built-in and action scope descends from it.
  const scope = createScope()
  const registry = createRegistry(notify)
  const diagnostics = createDiagnosticsLog(notify)
  let sequence = 0
  const internals: HostInternals = {
    registry,
    diagnostics,
    scope,
    context: services.context,
    // Preference writes may flip toggle `pressed` states and badges: surfaces re-read on notification.
    preferences: createPreferenceStore(services.storage, notify, { namespace: services.storageNamespace, signal: scope.signal }),
    storageNamespace: services.storageNamespace,
    nextSequence: () => sequence++,
    // Plugin-internal state changes (`api.invalidate`) re-read badges, toggles and predicates.
    notify,
  }
  const builtinIds = new Set<string>()
  /** Contributions whose `available` threw; hidden for good (no retry). */
  const failedPredicates = new WeakSet<QualifiedContribution>()

  const seen = new Set<string>()
  const plugins: InstalledPlugin[] = []
  options.plugins.forEach((entry, index) => {
    const { definition, options: pluginOptions } = normalizeEntry(entry)
    try {
      defineWorkbenchPlugin(definition)
      if (seen.has(definition.id)) throw new PluginDefinitionError('duplicate plugin id; the first configured entry is kept', definition.id)
    }
    catch (error) {
      diagnostics.record({ pluginId: attributedId(error, definition), phase: 'load', error })
      return
    }
    seen.add(definition.id)
    plugins.push(installPlugin(definition, pluginOptions, index, internals))
  })

  // Context changes may flip availability predicates: surfaces re-read on notification.
  const stopContext = services.context.subscribe(notify)
  const ready = Promise.all(plugins.map(plugin => plugin.settled)).then(() => {})

  /**
   * Evaluates `devOnly` and the `available` predicate of one contribution.
   * @param contribution Committed contribution.
   * @param context Surface context.
   */
  function isAvailable(contribution: QualifiedContribution, context: WorkbenchContext): boolean {
    if (failedPredicates.has(contribution)) return false
    if (contribution.devOnly && context.source.mode !== 'dev') return false
    if (!contribution.available) return true
    try {
      return Boolean((contribution.available as (context: unknown) => boolean)(context))
    }
    catch (error) {
      failedPredicates.add(contribution)
      diagnostics.record({ pluginId: contribution.pluginId, contributionId: contribution.id, phase: 'callback', error })
      return false
    }
  }

  /**
   * Registers an app-owned `builtin:` contribution, committed and notified immediately.
   * @param contribution Contribution with a local id.
   */
  function registerBuiltin(contribution: WorkbenchContribution): Disposer {
    if (!scope.active) return NOOP
    assertKnownKind(contribution, BUILTIN_NAMESPACE)
    const id = `${BUILTIN_NAMESPACE}:${String(contribution.id)}`
    if (!parseQualifiedId(id)) throw new Error(`[histoire] invalid built-in contribution id ${JSON.stringify(contribution.id)}`)
    if (registry.get(id)) throw new Error(`[histoire] duplicate built-in contribution "${id}"`)
    const order = typeof contribution.order === 'number' && Number.isFinite(contribution.order) ? contribution.order : 0
    const entry = {
      contribution: qualifyContribution(contribution, BUILTIN_NAMESPACE, id),
      rank: { builtin: true, order, configIndex: -1, sequence: sequence++ },
      owner: scope.signal,
    }
    builtinIds.add(id)
    registry.commit([entry])
    return () => {
      // Identity check keeps a stale disposer from removing a re-registered built-in.
      if (registry.get(id) !== entry) return
      builtinIds.delete(id)
      registry.remove([id])
    }
  }

  let disposal: Promise<void> | undefined

  return {
    ready,
    contributions: kind => registry.contributions(kind),
    available: (kind, context) => registry.contributions(kind).filter(contribution => isAvailable(contribution, context as WorkbenchContext)),
    registerBuiltin,
    subscribe(listener) {
      if (!scope.active) return NOOP
      const entry = (): void => listener()
      listeners.add(entry)
      return () => listeners.delete(entry)
    },
    mount: (contributionId, container, context, mountOptions = {}) => mountContribution(registry.get(contributionId), contributionId, container, context, mountOptions, diagnostics.record),
    reportViewError(contributionId, error, phase) {
      const entry = registry.get(contributionId)
      if (entry && scope.active) diagnostics.record({ pluginId: entry.contribution.pluginId, contributionId, phase, error })
    },
    run(contributionId, context, runOptions) {
      const runnable = resolveRunnable(registry, contributionId)
      if (!runnable) return Promise.reject(new Error(`[histoire] no runnable contribution "${contributionId}"`))
      const { entry } = runnable
      return runAction({
        run: runnable.run,
        context,
        // Plugin (or host) generation plus the caller's captured target scope.
        signals: [entry.owner, runOptions?.signal],
        onError: error => diagnostics.record({ pluginId: entry.contribution.pluginId, contributionId, phase: 'run', error }),
      })
    },
    diagnostics: () => diagnostics.list(),
    dispose() {
      // Assigned before teardown so reentrant calls from plugin disposers return early.
      if (disposal) return disposal
      disposal = Promise.resolve()
      stopContext()
      // Retire first: no plugin can register while others tear down.
      scope.retire()
      registry.batch(() => {
        for (const plugin of [...plugins].reverse()) plugin.dispose()
        registry.remove([...builtinIds])
        builtinIds.clear()
      })
      listeners.clear()
      return disposal
    },
  }
}
