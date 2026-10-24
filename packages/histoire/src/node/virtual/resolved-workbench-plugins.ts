import type { ResolvedWorkbenchPlugin } from '../config/workbench-plugins.js'
import type { Context } from '../context.js'

/** Vite command the manifest is generated for. */
export type ManifestCommand = 'serve' | 'build'

/**
 * Generates a lazy plugin manifest module for one entry kind.
 *
 * Entries keep config order and import nothing until `load()` runs, so the project's Vite
 * compiles plugin modules as separate chunks. Specifiers and options are emitted with
 * `JSON.stringify` (paths may contain quotes or spaces; options were validated as JSON).
 * @param plugins Resolved plugins, in config order.
 * @param entry Which entry the manifest lists.
 * @param exportName Exported binding name.
 * @param command Resolved Vite command; static builds leave dev-only entries out.
 */
export function generatePluginManifest(plugins: ResolvedWorkbenchPlugin[], entry: 'client' | 'frame', exportName: string, command: ManifestCommand): string {
  const entries = plugins
    .filter(plugin => plugin[entry] && !(command === 'build' && plugin.devOnly))
    .map(plugin => `  { id: ${JSON.stringify(plugin.id)}, apiVersion: ${plugin.apiVersion}, options: ${plugin.options === undefined ? 'undefined' : JSON.stringify(plugin.options)}, load: () => import(${JSON.stringify(plugin[entry])}) },`)
  return `export const ${exportName} = [\n${entries.join('\n')}\n]\n`
}

/**
 * Generates `virtual:$histoire-workbench-plugins`: lazy loaders of `workbench.client` entries.
 * @param ctx Histoire context holding resolved plugins.
 * @param command Resolved Vite command.
 */
export function resolvedWorkbenchPlugins(ctx: Context, command: ManifestCommand): string {
  return generatePluginManifest(ctx.workbenchPlugins ?? [], 'client', 'workbenchPlugins', command)
}
