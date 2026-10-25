import type { ServerStoryFile } from '@histoire/shared'
import type { StoryCollectionOutcome } from '../collect/outcome.js'
import type { Context } from '../context.js'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCollectionCache, readStorySourceSha256 } from '../collect/catalog-cache.js'
import { captureInlineDocs, getInlineDocs } from '../runtime/content/inline.js'
import { getContextRegistry } from '../runtime/registry.js'

/**
 * The dev server reuses the last collected catalog at startup (and collects
 * again in the background). These tests pin when a cached catalog may be used.
 */

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'histoire-collection-cache-'))
  await writeFile(join(root, 'histoire.config.ts'), 'export default {}')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

/** Dev context of the temp project, with the given story files registered. */
function createContext(storyFiles: ServerStoryFile[]): Context {
  return {
    root,
    config: { plugins: [{ name: 'builtin:vue3' }] } as unknown as Context['config'],
    resolvedViteConfig: {} as Context['resolvedViteConfig'],
    mode: 'dev',
    storyFiles,
    supportPlugins: [],
    markdownFiles: [],
    registeredCommands: [],
  }
}

/** Writes a story source and returns its registration. */
async function addStoryFile(path: string, code: string): Promise<ServerStoryFile> {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, code)
  return { id: 'a', path, relativePath: relative(root, path), fileName: 'A', supportPluginId: 'vue3', moduleId: path }
}

/** Outcome of a collected story whose raw metadata carries a Date (structured clone, not JSON). */
function collected(file: ServerStoryFile, sourceSha256: string): StoryCollectionOutcome {
  return { status: 'collected', sourceSha256, story: { id: `${file.id}-story`, title: 'A', variants: [{ id: 'v', title: 'V' }], meta: { at: new Date(0) } } }
}

/** Cache of a context, written once from collected outcomes of all its story files. */
async function writeCollected(ctx: Context) {
  const cache = createCollectionCache(ctx)
  const outcomes = new Map<string, StoryCollectionOutcome>()
  for (const file of ctx.storyFiles) outcomes.set(file.path, collected(file, (await readStorySourceSha256(ctx, file))!))
  await cache.write(ctx.storyFiles, outcomes)
  return outcomes
}

describe('createCollectionCache', () => {
  it('restores the outcomes of every unchanged story file', async () => {
    const file = await addStoryFile(join(root, 'src/A.story.vue'), '<Story />')
    const empty = await addStoryFile(join(root, 'src/Empty.story.vue'), '')
    const ctx = createContext([file, empty])
    const cache = createCollectionCache(ctx)
    await cache.write(ctx.storyFiles, new Map<string, StoryCollectionOutcome>([
      [file.path, collected(file, (await readStorySourceSha256(ctx, file))!)],
      [empty.path, { status: 'empty', sourceSha256: await readStorySourceSha256(ctx, empty) }],
    ]))

    const restored = await createCollectionCache(createContext([file, empty])).read(ctx.storyFiles)

    expect(restored?.get(file.path)).toEqual(expect.objectContaining({ status: 'collected', story: expect.objectContaining({ id: 'a-story', meta: { at: new Date(0) } }) }))
    expect(restored?.get(empty.path)).toEqual(expect.objectContaining({ status: 'empty' }))
    // Generated: ignored by git and Tailwind's source scan even if the project doesn't ignore `.histoire`.
    expect(existsSync(join(root, '.histoire/cache/.gitignore'))).toBe(true)
  })

  it('restores the inline docs captured while transforming a cached story', async () => {
    const file = await addStoryFile(join(root, 'src/A.story.vue'), '<Story />\n<docs>Hello</docs>')
    const previous = createContext([file])
    const sha = (await readStorySourceSha256(previous, file))!
    captureInlineDocs(previous, file.path, { html: '<p>Hello</p>', text: 'Hello', sourceSha256: sha })
    await writeCollected(previous)

    const next = createContext([file])
    await createCollectionCache(next).read([file])

    // Catalog docs read them; without a transform in this run they would be missing.
    expect(getInlineDocs(next, file.path, sha)).toEqual(expect.objectContaining({ html: '<p>Hello</p>', text: 'Hello' }))
  })

  it('is unusable when a story file changed, was added or failed to collect', async () => {
    const file = await addStoryFile(join(root, 'src/A.story.vue'), '<Story />')
    const ctx = createContext([file])
    await writeCollected(ctx)

    const added = await addStoryFile(join(root, 'src/B.story.vue'), '<Story />')
    expect(await createCollectionCache(ctx).read([file, added])).toBeUndefined()

    await writeFile(file.path, '<Story title="Changed" />')
    expect(await createCollectionCache(ctx).read([file])).toBeUndefined()

    const cache = createCollectionCache(ctx)
    await cache.write([file], new Map([[file.path, { status: 'failed', error: new Error('boom') }]]))
    expect(await cache.read([file])).toBeUndefined()
  })

  it('is unusable after the Histoire config changed', async () => {
    const file = await addStoryFile(join(root, 'src/A.story.vue'), '<Story />')
    const ctx = createContext([file])
    await writeCollected(ctx)

    await writeFile(join(root, 'histoire.config.ts'), 'export default { theme: {} }')

    expect(await createCollectionCache(ctx).read([file])).toBeUndefined()
  })

  it('matches generated stories of a previous run by their path inside the run temp dir', async () => {
    const previous = createContext([])
    const generated = await addStoryFile(join(getContextRegistry(previous).tempDir, 'plugins/tailwind/Tailwind.story.js'), 'export default {}')
    previous.storyFiles.push(generated)
    await writeCollected(previous)

    const next = createContext([])
    const regenerated = await addStoryFile(join(getContextRegistry(next).tempDir, 'plugins/tailwind/Tailwind.story.js'), 'export default {}')

    expect(getContextRegistry(next).tempDir).not.toBe(getContextRegistry(previous).tempDir)
    expect((await createCollectionCache(next).read([regenerated]))?.get(regenerated.path)?.status).toBe('collected')
  })
})
