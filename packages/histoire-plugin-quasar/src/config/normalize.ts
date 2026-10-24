import type { QuasarAssetEntry, RawQuasarConfig, ResolvedQuasarConfig } from './types.js'
import { join } from 'node:path'
import { getConfigSpinners, unique } from './utils.js'

/** Options for {@link normalizeQuasarConfig}. */
export interface NormalizeOptions {
  /** Quasar project root. */
  root: string
  /** File existence check, injectable for tests. */
  exists: (path: string) => boolean
  /** Every `@quasar/extras` animation name, for `animations: 'all'`. */
  allAnimations: () => string[]
}

/** Same lookup order as Quasar CLI's `resolveExtension`. */
const scriptExtensions = ['', '.js', '.ts', '.jsx', '.tsx']

/**
 * Resolve client asset paths the way Quasar CLI does: `~` prefix points to a
 * package, other entries are relative to `src/<folder>`.
 */
function resolveAssets(entries: QuasarAssetEntry[] = [], folder: string): string[] {
  const paths = entries
    .filter(Boolean)
    .map(entry => typeof entry === 'string' ? { path: entry } : entry as Exclude<QuasarAssetEntry, string | false | null | undefined>)
    .filter(entry => entry.path && entry.client !== false)
    .map(entry => entry.path.startsWith('~') ? entry.path.slice(1) : `@/${folder}/${entry.path}`)
  return unique(paths)
}

/** Quasar shorthand (`de`) or explicit path to a language pack / icon set module. */
function resolveQuasarModule(asset: string | undefined, type: 'lang' | 'icon-set'): string | undefined {
  if (!asset) return undefined
  if (!asset.includes('/')) return `quasar/${type}/${asset}.js`
  return /\.[cm]?[jt]s$/.test(asset) ? asset : `${asset}.js`
}

/** First existing file for a project path, with or without extension, as a POSIX path. */
export function resolveScript(root: string, file: string, exists: NormalizeOptions['exists']): string | undefined {
  return scriptExtensions.map(ext => join(root, file + ext)).find(exists)?.replace(/\\/g, '/')
}

/** Turn a raw `quasar.config` result into setup-ready values. */
export function normalizeQuasarConfig(raw: RawQuasarConfig, { root, exists, allAnimations }: NormalizeOptions): ResolvedQuasarConfig {
  const framework = raw.framework ?? {}
  const config = framework.config ?? {}
  const animations = raw.animations === 'all' ? allAnimations() : raw.animations ?? []
  const hasSassVariables = ['scss', 'sass'].some(ext => exists(join(root, `src/css/quasar.variables.${ext}`)))
  return {
    boot: resolveAssets(raw.boot, 'boot'),
    css: resolveAssets(raw.css, 'css'),
    extras: unique((raw.extras ?? []).filter(Boolean)),
    animations: unique(animations.filter(Boolean)),
    cssAddon: Boolean(framework.cssAddon),
    quasarSrcExt: hasSassVariables ? 'sass' : 'css',
    framework: {
      config,
      components: unique([...framework.components ?? [], ...getConfigSpinners(config).map(({ spinner }) => spinner)]),
      directives: unique(framework.directives ?? []),
      plugins: unique(framework.plugins ?? []),
      lang: resolveQuasarModule(framework.lang, 'lang'),
      iconSet: resolveQuasarModule(framework.iconSet, 'icon-set'),
    },
    storeFile: resolveScript(root, raw.sourceFiles?.store ?? 'src/stores/index', exists),
    hasRouter: Boolean(resolveScript(root, raw.sourceFiles?.router ?? 'src/router/index', exists)),
  }
}
