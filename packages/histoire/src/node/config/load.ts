import type { ConfigMode, HistoireConfig, PluginConfigContext } from '@histoire/shared'
import type { ModuleCache } from 'jiti'
import type { ConfigurationObserver, FileSnapshot } from './dependencies.js'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolveConfigFile } from '@histoire/dev-proxy/config'
import { createJiti } from 'jiti'
import path from 'pathe'
import pc from 'picocolors'
import { resolveConfig as resolveViteConfig } from 'vite'
import { parseConfigCode } from './codemod/parse.js'
import { getDefaultConfig } from './defaults.js'
import { recordConfigDependencies, snapshotLocalModules } from './dependencies.js'
import { mergeConfig } from './merge.js'

export { configFileNames, resolveConfigFile } from '@histoire/dev-proxy/config'

const __filename = fileURLToPath(import.meta.url)

/** One evaluated config file. */
interface LoadedConfigModule {
  /** Default export. */
  config: Partial<HistoireConfig>
  /** Absolute paths of every module jiti evaluated for it, the file itself included. */
  modules: string[]
  /** Exact source evaluated for this config generation. */
  source: string
}

/** Config source and original plugin objects remain server-only. */
const pluginSources = new WeakMap<HistoireConfig, { source: string, plugins: HistoireConfig['plugins'] }>()

/** Returns the plugin array captured before defaults and plugin hooks run. */
export function getPluginConfigSource(config: HistoireConfig) {
  return pluginSources.get(config)
}

/**
 * Imports a config file through jiti (so TypeScript configs work), keeping the module list.
 * `evalModule` with an owned cache is `jiti.import` minus resolution: every module jiti
 * transpiles for this load lands in that cache, also on filesystem cache hits. Modules Node
 * imports natively (`.mjs`, `.cjs`, `.js` in `type: module` packages) are not listed.
 * @param configFile Absolute config path.
 */
async function loadConfigModule(configFile: string, onInputs?: ConfigurationObserver): Promise<LoadedConfigModule> {
  const cache: ModuleCache = {}
  try {
    const jiti = createJiti(__filename, {
      moduleCache: false,
    })
    const source = await readFile(configFile, 'utf8')
    onInputs?.(new Map([[configFile, Buffer.from(source)]]))
    // Native ESM imports cache a JS config by filename even with moduleCache off.
    // Preserve native CommonJS loading while evaluating ESM config bytes freshly.
    let forceTranspile: true | undefined
    if (path.extname(configFile) === '.js') {
      try {
        if (parseConfigCode(source).program.body.some(statement => statement.type === 'ImportDeclaration' || statement.type.startsWith('Export'))) forceTranspile = true
      }
      catch { /* Let the existing loader report syntax errors. */ }
    }
    const module = await jiti.evalModule(source, { filename: configFile, ext: path.extname(configFile), cache, async: true, forceTranspile }) as { default?: unknown } | undefined
    const result = (module?.default ?? module) as Partial<HistoireConfig>
    if (!result) {
      throw new Error(`Expected default export in ${configFile}`)
    }
    return { config: result, modules: Object.keys(cache), source }
  }
  catch (e) {
    console.error(pc.red(`Error while loading ${configFile}`))
    throw e
  }
  finally {
    // Report loader-known local dependencies even if a later config hook fails.
    if (onInputs) onInputs(await snapshotLocalModules(Object.keys(cache)))
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
export async function resolveConfig(cwd: string = process.cwd(), mode: ConfigMode, configFile?: string, context?: PluginConfigContext, onInputs?: ConfigurationObserver): Promise<HistoireConfig> {
  let result: Partial<HistoireConfig>
  let histoireModules: Map<string, FileSnapshot> = new Map()
  let pluginSource: { source: string, plugins: HistoireConfig['plugins'] } | undefined
  const resolvedConfigFile = resolveConfigFile(cwd, configFile)
  if (resolvedConfigFile) {
    const loaded = await loadConfigModule(resolvedConfigFile, onInputs)
    result = loaded.config
    if (Array.isArray(result.plugins)) pluginSource = { source: loaded.source, plugins: [...result.plugins] }
    // Read right after evaluation: an edit landing before the watcher is ready still differs.
    histoireModules = await snapshotLocalModules(loaded.modules)
  }
  const viteConfig = await resolveViteConfig({ root: cwd }, mode === 'dev' ? 'serve' : 'build')
  const viteModules = await snapshotLocalModules(viteConfig.configFileDependencies)
  onInputs?.(viteModules)
  const viteHistoireConfig = (viteConfig.histoire ?? {}) as HistoireConfig

  const preUserConfig = mergeConfig(result, viteHistoireConfig)
  const processedDefaultConfig = await processDefaultConfig(getDefaultConfig(), preUserConfig, mode, context)

  const config = await resolveConfigPlugins(mergeConfig(preUserConfig, processedDefaultConfig), mode, context)
  if (pluginSource) pluginSources.set(config, pluginSource)
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
