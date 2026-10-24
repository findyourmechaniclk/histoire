import type { Plugin, UserConfig } from 'vite'
import type { RawQuasarConfig } from './types.js'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { runnerImport } from 'vite'
import { runInQuasarScope } from './process.js'
import { projectRequire } from './utils.js'

/** Config file names Quasar CLI looks for, in order. */
const configFiles = ['quasar.config.js', 'quasar.config.ts']

/** Quasar config file in `root`; throws a regular error when missing. */
export function findQuasarConfigFile(root: string): string {
  const file = configFiles.map(name => join(root, name)).find(existsSync)
  // Quasar CLI would walk up parent folders and could pick another project.
  if (!file) throw new Error(`No quasar.config.js or quasar.config.ts file found in ${root}`)
  return file
}

/** Quasar CLI context passed to the `quasar.config` function (SPA mode). */
function createQuasarContext(root: string, dev: boolean) {
  const srcDir = join(root, 'src')
  return {
    dev,
    prod: !dev,
    mode: { spa: true },
    modeName: 'spa',
    target: {},
    arch: {},
    bundler: {},
    debug: false,
    // Public context members configs commonly use to build paths.
    appPaths: {
      appDir: root,
      srcDir,
      publicDir: join(root, 'public'),
      resolve: {
        app: (path: string) => join(root, path),
        src: (path: string) => join(srcDir, path),
        public: (path: string) => join(root, 'public', path),
      },
    },
    logger: console,
  }
}

/** Identifiers `__dirname`/`__filename` are defined to, declared per file by {@link cjsGlobalsPlugin}. */
const cjsGlobals = { __dirname: '__hst_quasar_dirname__', __filename: '__hst_quasar_filename__' }

/**
 * Give each config module its own `__dirname`/`__filename`, like Quasar CLI's
 * config bundler does (a plain `define` would give every file the root's).
 */
function cjsGlobalsPlugin(): Plugin {
  return {
    name: 'histoire-plugin-quasar:cjs-globals',
    /** Prefix files using `__dirname`/`__filename` with their own values. */
    transform(code, id) {
      if (!/\.[cm]?[jt]s$/.test(id)) return
      let prefix = ''
      if (code.includes('__dirname')) prefix += `const ${cjsGlobals.__dirname} = ${JSON.stringify(dirname(id))};\n`
      if (code.includes('__filename')) prefix += `const ${cjsGlobals.__filename} = ${JSON.stringify(id)};\n`
      return prefix ? prefix + code : undefined
    },
  }
}

/** Quasar CLI's resolved SPA Vite config, from its public testing endpoint. */
export async function loadQuasarViteConfig(root: string, dev: boolean): Promise<UserConfig> {
  const { getTestingConfig } = await import('@quasar/app-vite/testing')
  return runInQuasarScope(root, () => getTestingConfig({ dev, prod: !dev, mode: 'spa' }))
}

/** Every `@quasar/extras` animation name, resolved from the project. */
export function loadAllAnimations(root: string): string[] {
  const require = projectRequire(root)
  const list = require('@quasar/extras/animate/animate-list.common')
  return [...list.generalAnimations, ...list.inAnimations, ...list.outAnimations]
}

/**
 * Evaluate the user `quasar.config` file directly. Fallback when Quasar CLI's
 * own loader is unavailable: App Extension hooks don't apply.
 */
export async function loadQuasarConfig(root: string, dev: boolean): Promise<RawQuasarConfig> {
  const file = findQuasarConfigFile(root)
  // Same cwd as the Quasar CLI path for `process.cwd()`/`path.resolve` in the config.
  return runInQuasarScope(root, async () => {
    const { module } = await runnerImport<{ default: unknown }>(file, {
      root,
      configFile: false,
      // Same alias and CommonJS globals Quasar CLI provides when bundling its config file.
      resolve: { alias: { '#q-app': '@quasar/app-vite' } },
      define: cjsGlobals,
      plugins: [cjsGlobalsPlugin()],
    })
    const exported = module.default
    return typeof exported === 'function'
      ? await exported(createQuasarContext(root, dev))
      : exported as RawQuasarConfig
  })
}
