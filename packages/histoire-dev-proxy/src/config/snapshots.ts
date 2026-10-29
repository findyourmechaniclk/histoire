import type { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { histoireConfigFiles, localConfigFiles, resolveConfigFile, viteConfigFileNames } from './discovery.js'

/** Exact file contents; undefined represents absence. */
export type FileSnapshot = Buffer | undefined
/** Acquisition inputs compared after watcher installation. */
export interface ConfigurationRevision {
  /** Selected Histoire config, including explicit missing path. */
  histoireFile: string | null
  /** Selected Vite config. */
  viteConfigFile: string | null
  /** Bytes captured before project evaluation. */
  snapshots: ReadonlyMap<string, FileSnapshot>
}

/** Reads absence distinctly from an empty config. */
export async function readFileSnapshot(file: string): Promise<FileSnapshot> {
  try {
    return await readFile(file)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
}

/** Captures config inputs before one runtime begins acquisition. */
export async function captureProjectConfigurationRevision(root: string, config?: string): Promise<ConfigurationRevision> {
  root = path.resolve(root)
  const histoireFile = resolveConfigFile(root, config)
  const viteFiles = localConfigFiles(root, viteConfigFileNames)
  const files = new Set([...histoireConfigFiles(root, config, histoireFile), ...viteFiles])
  if (histoireFile) files.add(path.resolve(histoireFile))
  const snapshots = new Map(await Promise.all([...files].map(async file => [file, await readFileSnapshot(file)] as const)))
  return { histoireFile, viteConfigFile: viteFiles.find(file => snapshots.get(file) !== undefined) ?? null, snapshots }
}
