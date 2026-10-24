import type { Context } from '../context.js'
import type { ManifestCommand } from './resolved-workbench-plugins.js'
import { generatePluginManifest } from './resolved-workbench-plugins.js'

/**
 * Generates `virtual:$histoire-frame-plugins`: lazy loaders of `workbench.frame` entries,
 * same shape and order as the workbench manifest.
 * @param ctx Histoire context holding resolved plugins.
 * @param command Resolved Vite command.
 */
export function resolvedFramePlugins(ctx: Context, command: ManifestCommand): string {
  return generatePluginManifest(ctx.workbenchPlugins ?? [], 'frame', 'framePlugins', command)
}
