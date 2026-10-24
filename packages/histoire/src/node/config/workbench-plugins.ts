import type { HistoireJsonValue } from '@histoire/protocol'
import type { ConfigMode, Plugin, WorkbenchPluginDescriptor } from '@histoire/shared'
import type { BrowserEntryResolver } from './browser-entries.js'
import { isHistoirePluginId, measureWireValue } from '@histoire/protocol'
import { PluginBrowserConfigError, resolveRequiredBrowserEntry } from './browser-entries.js'

/** Validated `Plugin.workbench` descriptor with entries resolved to files. */
export interface ResolvedWorkbenchPlugin {
  /** Descriptor id shared by Node, workbench and frame modules. */
  id: string
  /** Extension contract version. */
  apiVersion: 1
  /** Validated JSON options, the only plugin data that reaches the browser. */
  options: HistoireJsonValue | undefined
  /** Whether both entries are left out of static builds. */
  devOnly: boolean
  /** Absolute file of the workbench (`client`) entry. */
  client?: string
  /** Absolute file of the frame entry. */
  frame?: string
}

/** Namespace of built-in contributions; `isHistoirePluginId` rejects it too. */
const RESERVED_PLUGIN_ID = 'builtin'
const ENTRY_FIELDS = ['client', 'frame'] as const

/**
 * Checks the shape of one descriptor, without touching the file system.
 * @param descriptor `Plugin.workbench` value as configured.
 * @param owner Readable owner for error messages.
 * @throws {PluginBrowserConfigError} On the first invalid field.
 */
function validateDescriptor(descriptor: unknown, owner: string): asserts descriptor is WorkbenchPluginDescriptor {
  const fail = (field: string, message: string): never => {
    throw new PluginBrowserConfigError(owner, `workbench${field ? `.${field}` : ''}`, message)
  }
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) fail('', 'expected an object')
  const { id, apiVersion, options, devOnly } = descriptor as Record<string, unknown>
  if (id === RESERVED_PLUGIN_ID) fail('id', `"${RESERVED_PLUGIN_ID}" is reserved for built-in contributions`)
  // Same grammar as plugin-kit definitions and channel messages, all from `@histoire/protocol`.
  if (!isHistoirePluginId(id)) fail('id', `invalid id ${JSON.stringify(id)}; expected at most 64 lowercase letters, digits and dashes, starting with a letter`)
  if (apiVersion !== 1) fail('apiVersion', `unsupported version ${JSON.stringify(apiVersion)}; only 1 is supported`)
  for (const field of ENTRY_FIELDS) {
    const entry = (descriptor as Record<string, unknown>)[field]
    if (entry !== undefined && (typeof entry !== 'string' || !entry)) fail(field, 'expected a module specifier string')
  }
  if (ENTRY_FIELDS.every(field => (descriptor as Record<string, unknown>)[field] === undefined)) fail('client', 'expected a `client` or `frame` entry')
  if (devOnly !== undefined && typeof devOnly !== 'boolean') fail('devOnly', 'expected a boolean')
  if (options !== undefined) {
    try {
      // Same JSON DTO rules and budget as bridge requests: plain data only, no functions,
      // `undefined`, non-finite numbers, cycles or accessors.
      measureWireValue(options, { mode: 'json' })
    }
    catch (error) {
      fail('options', `expected JSON-serializable data (${error instanceof Error ? error.message : String(error)})`)
    }
  }
}

/**
 * Validates every `Plugin.workbench` descriptor and resolves its entries, in config order.
 * Plugins without a descriptor are skipped. In build mode dev-only descriptors are still
 * validated but not resolved, so a dev-only dependency may be absent from build installs.
 * @param plugins Resolved Histoire plugins, in config order.
 * @param resolveEntry Shared browser entry resolver.
 * @param mode Context mode.
 * @throws {PluginBrowserConfigError} Attributed to the plugin and field at fault.
 */
export async function resolveWorkbenchPlugins(plugins: Plugin[], resolveEntry: BrowserEntryResolver, mode: ConfigMode): Promise<ResolvedWorkbenchPlugin[]> {
  const result: ResolvedWorkbenchPlugin[] = []
  // Owner name per id, to name both plugins on a duplicate.
  const owners = new Map<string, string>()
  for (const plugin of plugins) {
    const descriptor = plugin.workbench
    if (descriptor === undefined) continue
    const owner = `plugin ${JSON.stringify(plugin.name)}`
    validateDescriptor(descriptor, owner)
    const previous = owners.get(descriptor.id)
    if (previous) throw new PluginBrowserConfigError(owner, 'workbench.id', `${JSON.stringify(descriptor.id)} is already used by ${previous}`)
    owners.set(descriptor.id, owner)

    const devOnly = descriptor.devOnly === true
    if (devOnly && mode === 'build') continue
    const resolved: ResolvedWorkbenchPlugin = { id: descriptor.id, apiVersion: 1, options: descriptor.options, devOnly }
    for (const field of ENTRY_FIELDS) {
      const specifier = descriptor[field]
      if (specifier) resolved[field] = await resolveRequiredBrowserEntry(resolveEntry, specifier, owner, `workbench.${field}`)
    }
    result.push(resolved)
  }
  return result
}
