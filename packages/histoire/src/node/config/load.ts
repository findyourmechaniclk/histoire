import type { ConfigMode, HistoireConfig, PluginConfigContext } from '@histoire/shared'
import type { ModuleCache } from 'jiti'
import type { FileSnapshot } from './dependencies.js'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import path from 'pathe'
import pc from 'picocolors'
import { resolveConfig as resolveViteConfig } from 'vite'
import { findUp } from '../util/find-up.js'
import { getDefaultConfig } from './defaults.js'
import { recordConfigDependencies, snapshotLocalModules } from './dependencies.js'
import { mergeConfig } from './merge.js'

const __filename = fileURLToPath(import.meta.url)

/** Config file names looked up from the working directory, in order. */
export const configFileNames = [
  'histoire.config.ts',
  'histoire.config.js',
  '.histoire.ts',
  '.histoire.js',
]

/**
 * Locates the Histoire config file.
 *
 * @param cwd Directory the search starts from.
 * @param configFile Explicit path, always resolved from `cwd` when given.
 * @returns The config file path, or `null` when the project has none (which is
 * supported: Histoire then runs on its defaults).
 */
export function resolveConfigFile(cwd: string = process.cwd(), configFile?: string): string | null {
  if (configFile) {
    // explicit config path is always resolved from cwd
    return path.resolve(cwd, configFile)
  }
  else {
    return findUp(cwd, configFileNames)
  }
}

/** One evaluated config file. */
interface LoadedConfigModule {
  /** Default export. */
  config: Partial<HistoireConfig>
  /** Absolute paths of every module jiti evaluated for it, the file itself included. */
  modules: string[]
}

/**
 * Imports a config file through jiti (so TypeScript configs work), keeping the module list.
 * `evalModule` with an owned cache is `jiti.import` minus resolution: every module jiti
 * transpiles for this load lands in that cache, also on filesystem cache hits. Modules Node
 * imports natively (`.mjs`, `.cjs`, `.js` in `type: module` packages) are not listed.
 * @param configFile Absolute config path.
 */
async function loadConfigModule(configFile: string): Promise<LoadedConfigModule> {
  try {
    const jiti = createJiti(__filename, {
      moduleCache: false,
    })
    const cache: ModuleCache = {}
    const source = await readFile(configFile, 'utf8')
    const module = await jiti.evalModule(source, { filename: configFile, ext: path.extname(configFile), cache, async: true }) as { default?: unknown } | undefined
    const result = (module?.default ?? module) as Partial<HistoireConfig>
    if (!result) {
      throw new Error(`Expected default export in ${configFile}`)
    }
    return { config: result, modules: Object.keys(cache) }
  }
  catch (e) {
    console.error(pc.red(`Error while loading ${configFile}`))
    throw e
  }
}

/**
 * Imports a config file through jiti (so TypeScript configs work) and returns
 * its default export.
 */
export async function loadConfigFile(configFile: string): Promise<Partial<HistoireConfig>> {
  return (await loadConfigModule(configFile)).config
}

/**
 * Resolves the final Histoire config: the config file, the `histoire` key of
 * the Vite config and the (plugin-processed) defaults, merged in that order.
 */
export async function resolveConfig(cwd: string = process.cwd(), mode: ConfigMode, configFile?: string, context?: PluginConfigContext): Promise<HistoireConfig> {
  let result: Partial<HistoireConfig>
  let histoireModules: Map<string, FileSnapshot> = new Map()
  const resolvedConfigFile = resolveConfigFile(cwd, configFile)
  if (resolvedConfigFile) {
    const loaded = await loadConfigModule(resolvedConfigFile)
    result = loaded.config
    // Read right after evaluation: an edit landing before the watcher is ready still differs.
    histoireModules = await snapshotLocalModules(loaded.modules)
  }
  const viteConfig = await resolveViteConfig({ root: cwd }, mode === 'dev' ? 'serve' : 'build')
  const viteModules = await snapshotLocalModules(viteConfig.configFileDependencies)
  const viteHistoireConfig = (viteConfig.histoire ?? {}) as HistoireConfig

  const preUserConfig = mergeConfig(result, viteHistoireConfig)
  const processedDefaultConfig = await processDefaultConfig(getDefaultConfig(), preUserConfig, mode, context)

  const config = await resolveConfigPlugins(mergeConfig(preUserConfig, processedDefaultConfig), mode, context)
  // Dev watchers restart when one of these local modules (e.g. a plugin source) changes.
  recordConfigDependencies(config, { histoire: histoireModules, vite: viteModules })
  return config
}

/** Applies the `config` hook of every resolved plugin. */
async function resolveConfigPlugins(config: HistoireConfig, mode: ConfigMode, context?: PluginConfigContext): Promise<HistoireConfig> {
  for (const plugin of config.plugins) {
    if (plugin.config) {
      const result = await plugin.config(config, mode, context)
      if (result) {
        config = mergeConfig(result, config)
      }
    }
  }
  return config
}

/** Applies the `defaultConfig` hook of the builtin and user plugins. */
async function processDefaultConfig(defaultConfig: HistoireConfig, preUserConfig: HistoireConfig, mode: ConfigMode, context?: PluginConfigContext): Promise<HistoireConfig> {
  // Apply plugins
  for (const plugin of [...defaultConfig.plugins, ...preUserConfig.plugins ?? []]) {
    if (plugin.defaultConfig) {
      const result = await plugin.defaultConfig(defaultConfig, mode, context)
      if (result) {
        defaultConfig = mergeConfig(result, defaultConfig)
      }
    }
  }
  return defaultConfig
}
