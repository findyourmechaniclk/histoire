import type { Context } from '../context.js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeContext, getContextRegistry } from '../runtime/registry.js'
import { markGeneratedDir } from '../util/generated-dir.js'

/**
 * Generated folders ignore themselves, so tools that honor `.gitignore` files
 * without a git repository (Tailwind 4's source scan) and projects that forgot
 * to ignore `.histoire` skip gigabytes of optimizer and run output.
 */

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'histoire-generated-dir-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('markGeneratedDir', () => {
  it('creates a self-ignoring folder and keeps an existing .gitignore', async () => {
    markGeneratedDir(join(root, 'a'))
    expect(readFileSync(join(root, 'a/.gitignore'), 'utf8')).toMatch(/^\*$/m)

    await mkdir(join(root, 'b'))
    writeFileSync(join(root, 'b/.gitignore'), 'keep\n')
    markGeneratedDir(join(root, 'b'))
    expect(readFileSync(join(root, 'b/.gitignore'), 'utf8')).toBe('keep\n')
  })

  it('marks the run temp dir and claimed plugin dirs of a project', async () => {
    const ctx = { root, mode: 'dev', config: { plugins: [] }, storyFiles: [], markdownFiles: [] } as unknown as Context
    const dir = getContextRegistry(ctx).pluginContext.claimDir('nuxt')

    expect(existsSync(join(root, '.histoire/tmp/.gitignore'))).toBe(true)
    expect(existsSync(join(dir, '.gitignore'))).toBe(true)
    await closeContext(ctx)
  })
})
