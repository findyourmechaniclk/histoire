import type { PluginCommand } from '@histoire/shared'
import type { ResolvedConfig } from 'vite'
import { existsSync } from 'node:fs'
import { join } from 'pathe'

/**
 * Resolves one browser module specifier written in plugin config.
 * @returns Absolute file path, or `null` when nothing matches.
 */
export type BrowserEntryResolver = (specifier: string) => Promise<string | null>

/** Invalid browser-facing plugin configuration, attributed to its owner and config field. */
export class PluginBrowserConfigError extends Error {
  /**
   * @param owner Readable owner, such as `plugin "acme"` or `command "acme:run"`.
   * @param field Config field path, such as `workbench.client`.
   * @param message Failure description.
   */
  constructor(owner: string, field: string, message: string) {
    super(`[histoire] ${owner} ${field}: ${message}`)
    this.name = 'PluginBrowserConfigError'
  }
}

/**
 * Creates the single resolution used for every browser module named in plugin config
 * (workbench and frame entries, command client setup files).
 *
 * Specifiers resolve through Vite as if imported from the project's root `index.html`:
 * bare specifiers use browser conditions and project aliases, relative paths are
 * project-root relative, `/path` is root-relative and absolute file paths stay as they are.
 * Resolving at startup makes a bad entry fail before any browser imports it, and yields
 * real files whose package directories can be added to `server.fs.allow`.
 * @param root Project root.
 * @param viteConfig Project Vite config resolved for the current command.
 */
export function createBrowserEntryResolver(root: string, viteConfig: ResolvedConfig): BrowserEntryResolver {
  // `createResolver` applies aliases and Vite's resolve plugin only, which is all a
  // config-time lookup needs; plugin `resolveId` hooks are not running yet.
  const resolveId = viteConfig.createResolver()
  const importer = join(root, 'index.html')
  return async (specifier) => {
    const resolved = await resolveId(specifier, importer)
    // Browser externals and virtual ids are not loadable entries.
    return resolved && existsSync(resolved) ? resolved : null
  }
}

/**
 * Resolves a required browser entry or throws an attributed config error.
 * @param resolveEntry Shared entry resolver.
 * @param specifier Specifier as configured.
 * @param owner Readable owner for the error message.
 * @param field Config field path for the error message.
 */
export async function resolveRequiredBrowserEntry(resolveEntry: BrowserEntryResolver, specifier: string, owner: string, field: string): Promise<string> {
  const resolved = await resolveEntry(specifier)
  if (!resolved) throw new PluginBrowserConfigError(owner, field, `cannot resolve ${JSON.stringify(specifier)} from the project root`)
  return resolved
}

/**
 * Resolves the `clientSetupFile` of every command that has one.
 * @param commands Registered plugin commands, in config order.
 * @param resolveEntry Shared entry resolver.
 * @returns Resolved file per command object.
 */
export async function resolveCommandClientSetupFiles(commands: PluginCommand[], resolveEntry: BrowserEntryResolver): Promise<Map<PluginCommand, string>> {
  const files = new Map<PluginCommand, string>()
  for (const command of commands) {
    const setup = command.clientSetupFile
    if (!setup) continue
    const specifier = typeof setup === 'string' ? setup : setup.file
    files.set(command, await resolveRequiredBrowserEntry(resolveEntry, specifier, `command ${JSON.stringify(command.id)}`, 'clientSetupFile'))
  }
  return files
}
