import type { UserConfig } from 'vite'
import type { QuasarCliConfig } from './from-cli.js'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runInQuasarScope } from './process.js'
import { projectRequire } from './utils.js'

/** Quasar CLI's normalized config and the SPA Vite config generated from it. */
export interface QuasarCliResult {
  /** Normalized config, App Extension hooks applied; `undefined` if its shape changed. */
  quasarConf?: QuasarCliConfig
  /** SPA Vite config generated from it. */
  viteConfig: UserConfig
}

/** Internal Quasar CLI modules used by its public `getTestingConfig`. */
interface QuasarCliModules {
  /** Creates the Quasar CLI context, locating the project from cwd. */
  getCtx: (options: { mode: string, dev: boolean, prod: boolean }) => { appExt: QuasarAppExt }
  /** Loads and normalizes `quasar.config`, running App Extension hooks. */
  QuasarConfigFile: new (options: { ctx: unknown }) => { read: () => Promise<unknown> }
  /** Generates the SPA Vite config from the normalized config. */
  quasarSpaConfig: { vite: (quasarConf: unknown) => Promise<UserConfig> }
}

/** Quasar CLI App Extension runner (subset). */
interface QuasarAppExt {
  /** Runs `fn` for each App Extension registered for hook `name`. */
  runAppExtensionHook: (name: string, fn: (hook: any) => Promise<void>) => Promise<void>
}

/**
 * Append a last `extendQuasarConf` step turning off Quasar dev server
 * features: Histoire runs its own server, so Quasar must not generate an
 * HTTPS certificate or plan to open a browser.
 */
export function disableDevServer(appExt: QuasarAppExt) {
  const run = appExt.runAppExtensionHook.bind(appExt)
  appExt.runAppExtensionHook = async (name, fn) => {
    await run(name, fn)
    if (name !== 'extendQuasarConf') return
    await fn({
      fn: (conf: { devServer?: Record<string, unknown> }) => {
        conf.devServer = { ...conf.devServer, https: false, open: false }
      },
      // Quasar only logs through `api.logger` around hooks; any method is a no-op.
      api: { logger: new Proxy({}, { get: () => () => {} }) },
      packageDir: '',
    })
  }
}

/** Whether Quasar CLI's normalized config still has the shape Histoire maps. */
export function isQuasarCliConfig(conf: any): conf is QuasarCliConfig {
  return typeof conf?.ctx?.appPaths?.appDir === 'string'
    && ['boot', 'css', 'extras', 'animations'].every(key => Array.isArray(conf[key]))
    && ['components', 'directives', 'plugins'].every(key => Array.isArray(conf.framework?.[key]))
    && typeof conf.sourceFiles?.store === 'string'
    && typeof conf.sourceFiles?.router === 'string'
    && typeof conf.metaConf?.hasStore === 'boolean'
    && typeof conf.metaConf?.css?.quasarSrcExt === 'string'
}

/** Import the project's own Quasar CLI internals; `undefined` if they moved. */
async function importQuasarCli(root: string): Promise<QuasarCliModules | undefined> {
  try {
    // Project's own Quasar CLI, as App Extensions are resolved from it.
    const cliDir = dirname(projectRequire(root).resolve('@quasar/app-vite/package.json'))
    const load = (file: string) => import(pathToFileURL(join(cliDir, file)).href)
    const [{ getCtx }, { QuasarConfigFile }, { quasarSpaConfig }] = await Promise.all([
      load('lib/utils/get-ctx.js'),
      load('lib/quasar-config-file.js'),
      load('lib/modes/spa/spa-config.js'),
    ])
    if (typeof getCtx !== 'function' || typeof QuasarConfigFile !== 'function' || typeof quasarSpaConfig?.vite !== 'function') return undefined
    return { getCtx, QuasarConfigFile, quasarSpaConfig }
  }
  catch {
    return undefined
  }
}

/**
 * Load the project config through Quasar CLI's own config loader, the same
 * steps as its public `getTestingConfig` endpoint, so App Extension
 * `extendQuasarConf` hooks apply to boot files, CSS and framework options too.
 * These modules are internal: returns `undefined` when they can't be loaded,
 * and no `quasarConf` when its shape changed. Config errors are thrown.
 */
export async function loadQuasarCli(root: string, dev: boolean): Promise<QuasarCliResult | undefined> {
  const cli = await importQuasarCli(root)
  if (!cli) return undefined
  return runInQuasarScope(root, async () => {
    const ctx = cli.getCtx({ mode: 'spa', dev, prod: !dev })
    if (typeof ctx.appExt?.runAppExtensionHook === 'function') disableDevServer(ctx.appExt)
    const quasarConf = await new cli.QuasarConfigFile({ ctx }).read()
    const viteConfig = await cli.quasarSpaConfig.vite(quasarConf)
    return { quasarConf: isQuasarCliConfig(quasarConf) ? quasarConf : undefined, viteConfig }
  })
}
