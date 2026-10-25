import type { Context } from '../context.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeContext, getContextRegistry } from '../runtime/registry.js'

/**
 * Plugins keep generated output across restarts in `.histoire/<name>` (e.g. the
 * Nuxt build dir), unless another live run of the project already uses it: two
 * runs regenerating the same files would race each other.
 */

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'histoire-claim-dir-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

function createContext(): Context {
  return { root, mode: 'dev', config: { plugins: [] }, storyFiles: [], markdownFiles: [] } as unknown as Context
}

describe('plugin context claimDir', () => {
  it('gives the persistent dir to one run at a time', async () => {
    const first = createContext()
    const second = createContext()
    const { pluginContext } = getContextRegistry(first)

    expect(pluginContext.claimDir('nuxt')).toBe(join(root, '.histoire', 'nuxt'))
    // Same run, same answer.
    expect(pluginContext.claimDir('nuxt')).toBe(join(root, '.histoire', 'nuxt'))
    expect(getContextRegistry(second).pluginContext.claimDir('nuxt')).toBe(join(getContextRegistry(second).tempDir, 'nuxt'))

    await closeContext(first)
    await closeContext(second)
    const third = createContext()
    expect(getContextRegistry(third).pluginContext.claimDir('nuxt')).toBe(join(root, '.histoire', 'nuxt'))
    await closeContext(third)
  })
})
