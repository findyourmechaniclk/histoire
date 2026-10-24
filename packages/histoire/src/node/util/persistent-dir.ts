import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'pathe'

const OWNER_FILE = '.histoire-owner'

/** Directories claimed by contexts of this process (the owner file only names the pid). */
const claimedInProcess = new Set<string>()

/** True when a process with this pid runs (EPERM: alive, owned by another user). */
function isAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** Pid recorded in an owner file, or `null` when it is missing or unreadable. */
function readOwnerPid(file: string): number | null {
  try {
    const { pid } = JSON.parse(readFileSync(file, 'utf8'))
    return typeof pid === 'number' ? pid : null
  }
  catch {
    return null
  }
}

/**
 * Claims a directory that persists across runs (e.g. Vite's optimizer cache)
 * for one owner at a time. Two live dev servers writing the same optimizer
 * output would invalidate each other's served dependencies, so callers fall
 * back to a run-owned directory when the claim fails. Locks left by processes
 * that no longer run are taken over.
 * @param dir Directory to claim, created when missing.
 * @returns Release function, or `null` when another live owner holds it.
 */
export function claimPersistentDir(dir: string): (() => void) | null {
  if (claimedInProcess.has(dir)) return null
  mkdirSync(dir, { recursive: true })
  const ownerFile = join(dir, OWNER_FILE)
  const owner = JSON.stringify({ pid: process.pid })
  try {
    writeFileSync(ownerFile, owner, { flag: 'wx' })
  }
  catch {
    const pid = readOwnerPid(ownerFile)
    // Another context of this process released without removing the file
    // only when it crashed mid-cleanup; any other live pid keeps ownership.
    if (pid !== null && pid !== process.pid && isAlive(pid)) return null
    writeFileSync(ownerFile, owner)
  }
  claimedInProcess.add(dir)
  let released = false
  return () => {
    if (released) return
    released = true
    claimedInProcess.delete(dir)
    try {
      unlinkSync(ownerFile)
    }
    catch {
      // Already removed
    }
  }
}
