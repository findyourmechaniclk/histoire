import { isHistoirePluginId } from '@histoire/protocol'
import { PluginDefinitionError } from './errors.js'

/** Namespace reserved for built-in workbench contributions (`builtin:props`). */
export const BUILTIN_NAMESPACE = 'builtin'

/** Local contribution ids: non-empty, no whitespace, no `:` (it separates the namespace). */
const LOCAL_ID_PATTERN = /^[^\s:]+$/

/** Parsed `${namespace}:${localId}` id. */
export interface ParsedQualifiedId {
  /** Plugin id, or `builtin`. */
  namespace: string
  /** Id local to the namespace. */
  localId: string
}

/**
 * Whether `id` is usable as a plugin id (`[a-z][a-z0-9-]*`, at most 64 characters, not
 * `builtin`). Same grammar as the Node descriptor and channel validation (`@histoire/protocol`).
 * @param id Candidate value of any type.
 */
export function isValidPluginId(id: unknown): id is string {
  return isHistoirePluginId(id)
}

/**
 * Throws an attributed error unless `id` is a valid plugin id.
 * @param id Candidate value of any type.
 */
export function assertPluginId(id: unknown): asserts id is string {
  if (id === BUILTIN_NAMESPACE) {
    throw new PluginDefinitionError(`plugin id "${BUILTIN_NAMESPACE}" is reserved for built-in contributions`)
  }
  if (!isValidPluginId(id)) {
    throw new PluginDefinitionError(`invalid plugin id ${JSON.stringify(id)}; expected at most 64 lowercase letters, digits and dashes, starting with a letter`)
  }
}

/**
 * Qualifies a local contribution id as `${pluginId}:${localId}`.
 * @param pluginId Owning plugin; `builtin` is rejected.
 * @param localId Id as written by the plugin.
 */
export function qualifyId(pluginId: string, localId: string): string {
  assertPluginId(pluginId)
  if (typeof localId !== 'string' || !LOCAL_ID_PATTERN.test(localId)) {
    throw new PluginDefinitionError(`invalid contribution id ${JSON.stringify(localId)}; expected a non-empty id without whitespace or ":"`, pluginId)
  }
  return `${pluginId}:${localId}`
}

/**
 * Splits a qualified id. Returns `null` for unqualified or malformed ids.
 * @param id Qualified id such as `acme:panel` or `builtin:props`.
 */
export function parseQualifiedId(id: string): ParsedQualifiedId | null {
  const separator = id.indexOf(':')
  if (separator < 0) return null
  const namespace = id.slice(0, separator)
  const localId = id.slice(separator + 1)
  const validNamespace = namespace === BUILTIN_NAMESPACE || isValidPluginId(namespace)
  return validNamespace && LOCAL_ID_PATTERN.test(localId) ? { namespace, localId } : null
}
