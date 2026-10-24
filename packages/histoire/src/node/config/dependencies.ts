import type { HistoireConfig } from '@histoire/shared'
import type { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import path from 'pathe'

/** Bytes of one watched file, or `undefined` while it does not exist. */
export type FileSnapshot = Buffer | undefined

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
 * Reads one file; a missing file is a distinct snapshot so creation and removal stay observable.
 * @param file Absolute path.
 */
export async function readFileSnapshot(file: string): Promise<FileSnapshot> {
  try {
    return await readFile(file)
  }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return
    throw error
  }
}

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
