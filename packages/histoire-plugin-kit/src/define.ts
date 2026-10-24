import type { FramePluginDefinition } from './types/frame.js'
import type { WorkbenchPluginDefinition } from './types/plugin.js'
import { PluginDefinitionError } from './errors.js'
import { assertPluginId } from './ids.js'

/** The only extension contract version. */
export const PLUGIN_API_VERSION = 1

/**
 * Validates fields shared by workbench and frame definitions plus the entry hook.
 * Errors carry the plugin id once it is known to be valid.
 * @param definition Untrusted definition value.
 * @param hook Name of the required entry function (`setup` or `attach`).
 */
function validateDefinition(definition: unknown, hook: 'setup' | 'attach'): void {
  if (typeof definition !== 'object' || definition === null) {
    throw new PluginDefinitionError(`plugin definition must be an object, received ${definition === null ? 'null' : typeof definition}`)
  }
  const { id, apiVersion } = definition as Record<string, unknown>
  assertPluginId(id)
  if (apiVersion !== PLUGIN_API_VERSION) {
    throw new PluginDefinitionError(`unsupported apiVersion ${JSON.stringify(apiVersion)}; expected ${PLUGIN_API_VERSION}`, id)
  }
  if (typeof (definition as Record<string, unknown>)[hook] !== 'function') {
    throw new PluginDefinitionError(`missing \`${hook}\` function`, id)
  }
}

/**
 * Declares the default export of a plugin `client` entry.
 * Returns the definition unchanged after validating `id`, `apiVersion` and `setup`.
 * @param definition Plugin identity and setup hook.
 * @throws {PluginDefinitionError} When the definition is invalid.
 */
export function defineWorkbenchPlugin(definition: WorkbenchPluginDefinition): WorkbenchPluginDefinition {
  validateDefinition(definition, 'setup')
  return definition
}

/**
 * Declares the default export of a plugin `frame` entry.
 * Returns the definition unchanged after validating `id`, `apiVersion` and `attach`.
 * @param definition Plugin identity and attach hook.
 * @throws {PluginDefinitionError} When the definition is invalid.
 */
export function defineFramePlugin(definition: FramePluginDefinition): FramePluginDefinition {
  validateDefinition(definition, 'attach')
  return definition
}
