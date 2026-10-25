import type { ServerStory, ServerStoryFile } from '@histoire/shared'
import type { StoryCollectionOutcome } from '../collect/outcome.js'
import type { Context } from '../context.js'
import type { CollectionEvent } from '../server/collect.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { finalizeCollectedStoryFile } from '../collect/finalize.js'
import { createStoryCollector } from '../server/collect.js'
import * as VirtualFiles from '../virtual/index.js'

/**
 * Dev startup reuses the cached catalog of the previous run, then collects
 * again in the background without blocking execution admission.
 */

/** Fake Vite dev server recording the messages the collector pushes. */
function createServer() {
  const sent: any[] = []
  return { sent, ws: { send: (event: string, payload: unknown) => sent.push({ event, payload }) } }
}

function createContext(storyFiles: ServerStoryFile[]): Context {
  return {
    root: '/project',
    config: { tree: { file: 'title' } } as Context['config'],
    resolvedViteConfig: {} as Context['resolvedViteConfig'],
    mode: 'dev',
    storyFiles,
    supportPlugins: [],
    markdownFiles: [],
    registeredCommands: [],
  }
}

const rawStory: ServerStory = { id: 'story-a', title: 'Group/A', variants: [{ id: 'v1', title: 'V1' }] }

/** Wires a collector with a cache holding `cached`; execution collects `collected`. */
function setup(cached: Map<string, StoryCollectionOutcome> | undefined, collected: ServerStory = rawStory) {
  const file: ServerStoryFile = { id: 'a', path: '/project/a.story.vue', relativePath: 'a.story.vue', fileName: 'a', supportPluginId: 'vue3', moduleId: '/project/a.story.vue' }
  const ctx = createContext([file])
  const server = createServer()
  const invalidated: string[] = []
  const executeStoryFile = vi.fn(async (storyFile: ServerStoryFile): Promise<StoryCollectionOutcome> => {
    finalizeCollectedStoryFile(storyFile, ctx, structuredClone(collected))
    return { status: 'collected', sourceSha256: 'sha', story: structuredClone(collected) }
  })
  const cache = { read: vi.fn(async () => cached), write: vi.fn(async () => {}) }
  const collector = createStoryCollector({
    ctx,
    server: server as any,
    collectStories: { clearCache: vi.fn(), executeStoryFile },
    invalidateModule: id => invalidated.push(id),
    invalidateModuleSilently: id => invalidated.push(`silent:${id}`),
    cache,
  })
  const events: CollectionEvent[] = []
  collector.onCollection((event) => {
    events.push(event)
  })
  return { file, ctx, server, invalidated, executeStoryFile, cache, collector, events }
}

describe('createStoryCollector restore', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('publishes the cached catalog without executing story files', async () => {
    const { file, executeStoryFile, collector, events, server } = setup(new Map([['/project/a.story.vue', { status: 'collected', sourceSha256: 'sha', story: rawStory }]]))

    expect(await collector.restore()).toBe(true)

    expect(executeStoryFile).not.toHaveBeenCalled()
    expect(events.map(event => event.phase)).toEqual(['completed'])
    expect(events[0].outcomes.get(file.path)?.status).toBe('collected')
    // Finalized like a collected story, from a copy of the cached data.
    expect(file.story).toEqual(expect.objectContaining({ id: 'story-a', title: 'A' }))
    expect(file.treePath).toEqual(['Group', 'A'])
    expect(rawStory.title).toBe('Group/A')
    expect(server.sent).toEqual([])
  })

  it('collects as usual when the cache is unusable', async () => {
    const { collector, events, executeStoryFile } = setup(undefined)

    expect(await collector.restore()).toBe(false)

    expect(events).toEqual([])
    expect(executeStoryFile).not.toHaveBeenCalled()
  })

  it('revalidates in the background without blocking admission or reloading unchanged stories', async () => {
    const { collector, events, executeStoryFile, invalidated, server, cache } = setup(new Map([['/project/a.story.vue', { status: 'collected', sourceSha256: 'sha', story: rawStory }]]))
    await collector.restore()
    // Restoring refreshes the catalog modules once, like a completed collection.
    expect(invalidated).toContain(VirtualFiles.RESOLVED_STORIES_ID)
    events.length = 0
    invalidated.length = 0

    await collector.revalidate()

    expect(executeStoryFile).toHaveBeenCalledOnce()
    expect(events.map(event => [event.phase, event.revalidate])).toEqual([['started', true], ['completed', true]])
    expect(invalidated).toEqual([])
    expect(server.sent).toEqual([])
    expect(cache.write).toHaveBeenCalledOnce()
  })

  it('reloads the catalog modules when revalidation finds other metadata', async () => {
    const { collector, invalidated, file } = setup(new Map([['/project/a.story.vue', { status: 'collected', sourceSha256: 'sha', story: rawStory }]]), { ...rawStory, variants: [...rawStory.variants, { id: 'v2', title: 'V2' }] })
    await collector.restore()
    invalidated.length = 0

    await collector.revalidate()

    expect(file.story?.variants).toHaveLength(2)
    expect(invalidated).toContain(VirtualFiles.RESOLVED_STORIES_ID)
    expect(invalidated).toContain(`silent:${VirtualFiles.RESOLVED_PREVIEW_RUNTIME_ID}`)
  })

  it('writes the cache after a regular collection', async () => {
    const { collector, cache, ctx, file } = setup(undefined)

    await collector.collect()

    expect(cache.write).toHaveBeenCalledWith(ctx.storyFiles, expect.any(Map))
    expect((cache.write.mock.calls[0] as unknown[])[1]).toEqual(new Map([[file.path, expect.objectContaining({ status: 'collected' })]]))
  })
})
