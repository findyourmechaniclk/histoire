import type { WatchInput } from '../protocol.js'
import type { ConfigurationRevision, FileSnapshot } from './snapshots.js'
import path from 'node:path'
import { histoireConfigFiles, localConfigFiles, resolveConfigFile, viteConfigFileNames, watchedConfigFiles } from './discovery.js'
import { readFileSnapshot } from './snapshots.js'

/** Build identical priority-aware inputs for CLI proxy and SDK compatibility watches. */
export async function configurationWatchInputs(options: {
  /** Project root. */
  root: string
  /** Explicit Histoire config selection. */
  config?: string
  /** Vite config selected by acquired runtime, or acquisition snapshot by default. */
  viteFile?: string | null
  /** Pre-evaluation bytes close watcher-installation races. */
  revision?: ConfigurationRevision
  /** Loader-known imported local modules. */
  dependencies?: { histoire: ReadonlyMap<string, FileSnapshot>, vite: ReadonlyMap<string, FileSnapshot> }
}): Promise<WatchInput[]> {
  const root = path.resolve(options.root)
  const revision = options.revision
  const histoireFile = resolveConfigFile(root, options.config)
  const viteFile = options.viteFile === undefined ? revision?.viteConfigFile ?? null : options.viteFile
  const files = new Map<string, string>()
  for (const file of watchedConfigFiles(localConfigFiles(root, viteConfigFileNames), viteFile, revision?.viteConfigFile ?? null)) files.set(file, 'Vite')
  const histoireCandidates = histoireConfigFiles(root, options.config, revision?.histoireFile ?? histoireFile)
  for (const file of watchedConfigFiles(histoireCandidates, histoireFile, revision?.histoireFile ?? null)) files.set(file, 'Histoire')
  const loaded = new Map<string, FileSnapshot>()
  for (const [source, modules] of [['Histoire', options.dependencies?.histoire], ['Vite', options.dependencies?.vite]] as const) {
    for (const [file, snapshot] of modules ?? []) {
      if (files.has(file)) continue
      files.set(file, source)
      loaded.set(file, snapshot)
    }
  }
  return Promise.all([...files].map(async ([file, source]) => {
    const bytes = revision?.snapshots.has(file) ? revision.snapshots.get(file) : loaded.has(file) ? loaded.get(file) : await readFileSnapshot(file)
    return { file, source, bytes: bytes?.toString('base64') ?? null }
  }))
}
