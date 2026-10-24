import type { QuasarAssetEntry, ResolvedQuasarConfig } from './types.js'
import { resolveScript } from './normalize.js'

/** Subset of Quasar CLI's normalized `quasarConf` used by Histoire. */
export interface QuasarCliConfig {
  /** Quasar CLI context; only the project folder is used. */
  ctx: { appPaths: { appDir: string } }
  /** Normalized boot entries (`@/boot/...` or package paths). */
  boot: Exclude<QuasarAssetEntry, string | false | null | undefined>[]
  /** Normalized stylesheet entries. */
  css: Exclude<QuasarAssetEntry, string | false | null | undefined>[]
  /** `@quasar/extras` asset names. */
  extras: string[]
  /** Animation names, `'all'` already expanded. */
  animations: string[]
  /** Normalized framework options (spinners added to components, lang/iconSet as paths). */
  framework: Omit<ResolvedQuasarConfig['framework'], 'lang' | 'iconSet'> & {
    lang?: string
    iconSet?: string
    cssAddon?: boolean
  }
  /** Project-relative source file paths. */
  sourceFiles: { store: string, router: string }
  /** Values Quasar CLI computed from the project files. */
  metaConf: { hasStore: boolean, css: { quasarSrcExt: 'css' | 'sass' } }
}

/** Client asset paths of normalized Quasar CLI entries. */
function clientPaths(entries: QuasarCliConfig['boot']): string[] {
  return entries.filter(entry => entry.client !== false).map(entry => entry.path)
}

/**
 * Map Quasar CLI's own normalized config (App Extension hooks applied) to
 * setup-ready values. Quasar already resolved paths, spinners and animations.
 */
export function fromQuasarCliConfig(conf: QuasarCliConfig, { exists }: { exists: (path: string) => boolean }): ResolvedQuasarConfig {
  const { appDir } = conf.ctx.appPaths
  const { framework } = conf
  return {
    boot: clientPaths(conf.boot),
    css: clientPaths(conf.css),
    extras: conf.extras,
    animations: conf.animations,
    cssAddon: Boolean(framework.cssAddon),
    quasarSrcExt: conf.metaConf.css.quasarSrcExt,
    framework: {
      config: framework.config,
      components: framework.components,
      directives: framework.directives,
      plugins: framework.plugins,
      lang: framework.lang,
      iconSet: framework.iconSet,
    },
    storeFile: conf.metaConf.hasStore ? resolveScript(appDir, conf.sourceFiles.store, exists) : undefined,
    hasRouter: Boolean(resolveScript(appDir, conf.sourceFiles.router, exists)),
  }
}
