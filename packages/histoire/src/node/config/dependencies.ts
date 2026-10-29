import type { FileSnapshot } from '@histoire/dev-proxy/config'
import type { HistoireConfig } from '@histoire/shared'
import { readFileSnapshot } from '@histoire/dev-proxy/config'
import path from 'pathe'

export { readFileSnapshot } from '@histoire/dev-proxy/config'

/** Bytes of one watched file, or `undefined` while it does not exist. */
export type { FileSnapshot } from '@histoire/dev-proxy/config'

/** CLI parent learns inputs during evaluation, even before runtime acquisition succeeds. */
export type ConfigurationObserver = (files: ReadonlyMap<string, FileSnapshot>) => void

/**
 * Local modules (outside `node_modules`) evaluated while loading the config files, keyed by
 * absolute path, with their bytes read right after loading. A later difference means the
 * loaded configuration may be stale.
 */
export interface ConfigDependencies {
  /** Modules the Histoire config file imported (directly or transitively). */
  histoire: ReadonlyMap<string, FileSnapshot>
  /** Modules the Vite config file imported (Vite's bundled config dependencies). */
  vite: ReadonlyMap<string, FileSnapshot>
}

/** Dependencies recorded per resolved config object; the config owns their lifetime. */
const recorded = new WeakMap<object, ConfigDependencies>()

/**
 * Snapshots the local modules among loader-reported dependencies. Installed packages are left to
 * the package manager: they change through installs, which already need a restart.
 * @param files Absolute module paths reported by the loader.
 */
export async function snapshotLocalModules(files: Iterable<string>): Promise<Map<string, FileSnapshot>> {
  const local = [...new Set([...files].map(file => path.resolve(file)))]
    .filter(file => !file.split('/').includes('node_modules'))
  return new Map(await Promise.all(local.map(async file => [file, await readFileSnapshot(file)] as const)))
}

/**
 * Attaches loader dependencies to the config they produced.
 * @param config Resolved config.
 * @param dependencies Local module snapshots.
 */
export function recordConfigDependencies(config: HistoireConfig, dependencies: ConfigDependencies): void {
  recorded.set(config, dependencies)
}

/**
 * Local modules the given resolved config was loaded from, `undefined` for configs that did not
 * come from {@link recordConfigDependencies} (test doubles, hand-built contexts).
 * @param config Resolved config.
 */
export function getConfigDependencies(config: HistoireConfig | undefined): ConfigDependencies | undefined {
  return config ? recorded.get(config) : undefined
}
