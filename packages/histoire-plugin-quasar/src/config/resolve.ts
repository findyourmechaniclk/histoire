import type { UserConfig } from 'vite'
import type { ResolvedQuasarConfig } from './types.js'
import { existsSync } from 'node:fs'
import { fromQuasarCliConfig } from './from-cli.js'
import { findQuasarConfigFile, loadAllAnimations, loadQuasarConfig, loadQuasarViteConfig } from './load.js'
import { normalizeQuasarConfig } from './normalize.js'
import { loadQuasarCli } from './quasar-cli.js'

/** Quasar project resolved for Histoire. */
export interface ResolvedQuasarProject {
  /** Quasar CLI's SPA Vite config. */
  viteConfig: UserConfig
  /** Setup-ready config. */
  config: ResolvedQuasarConfig
}

/**
 * Resolve a Quasar CLI project. Prefers Quasar CLI's own config loader, which
 * applies App Extensions; falls back to evaluating `quasar.config` directly.
 */
export async function resolveQuasarProject(root: string, dev: boolean): Promise<ResolvedQuasarProject> {
  findQuasarConfigFile(root)

  const cli = await loadQuasarCli(root, dev)
  if (cli?.quasarConf) {
    return {
      viteConfig: cli.viteConfig,
      config: fromQuasarCliConfig(cli.quasarConf, { exists: existsSync }),
    }
  }

  console.warn('[@histoire/plugin-quasar] Quasar CLI config loader unavailable: boot files, CSS and framework options added by App Extensions are not loaded.')
  return {
    // Keep Quasar CLI's Vite config when only its normalized config changed shape.
    viteConfig: cli?.viteConfig ?? await loadQuasarViteConfig(root, dev),
    config: normalizeQuasarConfig(await loadQuasarConfig(root, dev), {
      root,
      exists: existsSync,
      allAnimations: () => loadAllAnimations(root),
    }),
  }
}
