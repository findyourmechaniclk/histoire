import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { claimPersistentDir } from '../util/persistent-dir.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** Fresh directory standing for `.histoire/cache/vite/dev-client`. */
function createDir() {
  const root = mkdtempSync(join(tmpdir(), 'histoire-persistent-dir-'))
  roots.push(root)
  return join(root, 'cache')
}

describe('claimPersistentDir', () => {
  it('gives the directory to one owner at a time', () => {
    const dir = createDir()
    const release = claimPersistentDir(dir)
    expect(release).toBeTypeOf('function')
    // A second dev context in the same or another process must not share
    // Vite's optimizer output with a live owner.
    expect(claimPersistentDir(dir)).toBeNull()
    release!()
    const next = claimPersistentDir(dir)
    expect(next).toBeTypeOf('function')
    next!()
  })

  it('takes over a lock left by a process that no longer runs', () => {
    const dir = createDir()
    mkdirSync(dir, { recursive: true })
    // Highest Linux pid; no live process uses it in a test environment.
    writeFileSync(join(dir, '.histoire-owner'), JSON.stringify({ pid: 4_194_304 }))
    const release = claimPersistentDir(dir)
    expect(release).toBeTypeOf('function')
    release!()
    expect(existsSync(join(dir, '.histoire-owner'))).toBe(false)
  })

  it('respects a lock held by another live process', () => {
    const dir = createDir()
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '.histoire-owner'), JSON.stringify({ pid: process.ppid }))
    expect(claimPersistentDir(dir)).toBeNull()
  })
})
