import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pruneStaleRunDirs } from '../util/stale-run-dirs.js'
import { getProjectTempDir, getRunTempDir } from '../util/temp-paths.js'

/**
 * Killed runs never delete their `.histoire/tmp/<kind>/run-*` directory; the
 * next run removes the ones whose process is gone.
 */

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'histoire-stale-runs-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

/** Pid of a process that already exited. */
function deadPid() {
  return spawnSync(process.execPath, ['-e', '']).pid!
}

/** Creates a run directory named like one of `owner`'s runs, started at `time`. */
async function createRunDir(kind: string, owner: { pid: number, time?: number }) {
  const ownDir = getRunTempDir(root, kind)
  // Same naming as a real run of this host, with another pid / start time.
  const name = basename(ownDir)
    .replace(/^run-[0-9a-z]+-/, `run-${(owner.time ?? Date.now()).toString(36)}-`)
    .replace(/-p[0-9a-z]+h/, `-p${owner.pid.toString(36)}h`)
  const dir = join(getProjectTempDir(root), kind, name)
  await mkdir(dir, { recursive: true })
  return dir
}

describe('pruneStaleRunDirs', () => {
  it('removes run dirs of processes that exited, keeping live runs', async () => {
    const dead = await createRunDir('dev', { pid: deadPid() })
    const deadBuild = await createRunDir('build', { pid: deadPid() })
    const live = await createRunDir('dev', { pid: process.pid })

    await pruneStaleRunDirs(root)

    expect(existsSync(dead)).toBe(false)
    expect(existsSync(deadBuild)).toBe(false)
    expect(existsSync(live)).toBe(true)
  })

  it('keeps runs of other hosts and unknown entries', async () => {
    const otherHost = join(getProjectTempDir(root), 'dev', `run-${Date.now().toString(36)}-p${deadPid().toString(36)}h000000-0123abcd`)
    const unknown = join(getProjectTempDir(root), 'dev', 'something-else')
    await mkdir(otherHost, { recursive: true })
    await mkdir(unknown, { recursive: true })

    await pruneStaleRunDirs(root)

    expect(existsSync(otherHost)).toBe(true)
    expect(existsSync(unknown)).toBe(true)
  })

  it('removes run dirs named without owner once they are a day old', async () => {
    const day = 24 * 60 * 60 * 1000
    const old = join(getProjectTempDir(root), 'dev', `run-${(Date.now() - 2 * day).toString(36)}-0123abcd`)
    const recent = join(getProjectTempDir(root), 'dev', `run-${(Date.now() - 60_000).toString(36)}-0123abcd`)
    await mkdir(old, { recursive: true })
    await mkdir(recent, { recursive: true })

    await pruneStaleRunDirs(root)

    expect(existsSync(old)).toBe(false)
    expect(existsSync(recent)).toBe(true)
  })

  it('does nothing without a temp dir', async () => {
    await expect(pruneStaleRunDirs(root)).resolves.toBeUndefined()
  })
})
