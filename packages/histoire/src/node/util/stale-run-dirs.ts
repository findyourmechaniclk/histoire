import { readdir, rm } from 'node:fs/promises'
import { join } from 'pathe'
import { isAlive } from './persistent-dir.js'
import { getHostTag, getProjectTempDir } from './temp-paths.js'

/** Run directories named before they carried an owner are removed after this age. */
const LEGACY_MAX_AGE = 24 * 60 * 60 * 1000

/** `run-<start>-p<pid>h<host>-<id>`, see `getRunTempDir`. */
const OWNED_RUN = /^run-[0-9a-z]+-p([0-9a-z]+)h([0-9a-f]{6})-[0-9a-f]{8}$/
/** `run-<start>-<id>`, written by earlier releases. */
const LEGACY_RUN = /^run-([0-9a-z]+)-[0-9a-f]{8}$/

/** Projects already pruned by this process. */
const pruned = new Set<string>()

/** Whether a run directory name belongs to a run that can no longer remove it. */
function isStale(name: string, host: string) {
  const owned = OWNED_RUN.exec(name)
  if (owned) return owned[2] === host && !isAlive(Number.parseInt(owned[1], 36))
  const legacy = LEGACY_RUN.exec(name)
  return !!legacy && Date.now() - Number.parseInt(legacy[1], 36) > LEGACY_MAX_AGE
}

/**
 * Removes `.histoire/tmp/<kind>/run-*` directories left by runs that were
 * killed before their cleanup (they can hold gigabytes of optimizer output).
 * Directories of live processes and of other hosts are kept.
 * @param root The project root.
 */
export async function pruneStaleRunDirs(root: string): Promise<void> {
  const tempDir = getProjectTempDir(root)
  const host = getHostTag()
  const kinds = await readdir(tempDir, { withFileTypes: true }).catch(() => [])
  await Promise.all(kinds.filter(kind => kind.isDirectory()).map(async (kind) => {
    const runs = await readdir(join(tempDir, kind.name)).catch(() => [])
    await Promise.all(runs.filter(name => isStale(name, host)).map(name => rm(join(tempDir, kind.name, name), { recursive: true, force: true, maxRetries: 3 }).catch(() => {})))
  }))
}

/** Prunes a project once per process, in the background. */
export function pruneStaleRunDirsOnce(root: string): void {
  if (pruned.has(root)) return
  pruned.add(root)
  void pruneStaleRunDirs(root)
}
