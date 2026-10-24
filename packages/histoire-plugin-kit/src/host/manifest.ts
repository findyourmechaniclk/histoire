import type { HistoireJsonValue } from '@histoire/protocol'
import type { ExtensionHostPlugin } from '../types/host.js'
import type { WorkbenchPluginDefinition } from '../types/plugin.js'
import { defineWorkbenchPlugin } from '../define.js'
import { PluginDefinitionError } from '../errors.js'

/** One configured `workbench.client` entry, as `virtual:$histoire-workbench-plugins` exports it. */
export interface WorkbenchPluginManifestEntry {
  /** Plugin id from the Node descriptor. */
  id: string
  /** Extension contract version from the Node descriptor. */
  apiVersion: number
  /** Validated browser-visible JSON options. */
  options: HistoireJsonValue | undefined
  /** Imports the entry module; its default export is the plugin definition. */
  load: () => Promise<{ default: unknown }>
}

/**
 * Wraps one lazy manifest entry in a definition the host can install immediately. The module
 * import runs inside `setup`, so the host never waits for plugin code before the workbench
 * paints; a failed import or an invalid export becomes an attributed setup diagnostic and
 * never affects sibling plugins.
 * @param entry Manifest entry.
 */
function lazyPlugin(entry: WorkbenchPluginManifestEntry): ExtensionHostPlugin {
  const definition = {
    id: entry.id,
    // Unsupported versions are rejected by the host before anything loads.
    apiVersion: entry.apiVersion as 1,
    async setup(api) {
      const loaded = (await entry.load()).default as WorkbenchPluginDefinition
      // Disposed while importing: never run setup for a retired host.
      if (api.signal.aborted) return
      defineWorkbenchPlugin(loaded)
      if (loaded.id !== entry.id) {
        throw new PluginDefinitionError(`client entry exports plugin "${loaded.id}"; expected "${entry.id}"`, entry.id)
      }
      return loaded.setup(api)
    },
  } satisfies WorkbenchPluginDefinition
  return { definition, options: entry.options }
}

/**
 * Converts a book's own plugin manifest into host plugins, keeping config order. Only documents
 * served by the book (standalone, source-origin explorer) use it; remote hosts import plugins
 * explicitly and never evaluate a book's modules.
 * @param entries Manifest entries.
 */
export function lazyWorkbenchPlugins(entries: readonly WorkbenchPluginManifestEntry[]): ExtensionHostPlugin[] {
  return entries.map(lazyPlugin)
}
