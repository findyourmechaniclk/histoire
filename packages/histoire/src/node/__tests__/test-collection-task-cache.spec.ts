import type { HistoireProjectTestCollectionResult } from '@histoire/protocol'
import type { Context } from '../context.js'
import type { CollectHistoireTestsOptions } from '../test/types.js'
import { afterEach, expect, it, vi } from 'vitest'
import { getDefaultConfig } from '../config/defaults.js'
import * as attachment from '../runtime/catalog/attachment.js'
import { createRuntimeCatalog } from '../runtime/catalog/publication.js'
import { createHistoireTestCollectionTask } from '../test/execution-service.js'
import { createMcpContext, createMcpProjectFixture, createMcpStory, MCP_PROJECT_OPTIONS } from './utils/mcp/project.js'

/** Story IDs whose captured dependency evidence still verifies. */
const valid = new Set<string>()
/** Stories each mounted collection was asked for, in request order. */
const mounted: string[][] = []
/** Stories whose mount waits for cancellation, like a slow Nuxt variant. */
const hanging = new Set<string>()

// Dependency proofs are covered by real Vite in test-collection-evidence.spec;
// here each evidence object names its story so tests choose what stays valid.
vi.mock('../test/eligibility/index.js', () => ({
  captureTestCollectionGeneration: () => ({ token: {}, assertCurrent() {}, verify: async (evidence: { storyId: string }) => valid.has(evidence.storyId) }),
  captureTestCollectionEligibility: async (_ctx: Context, ids: string[]) => ({ knownEmptyStoryIds: [], evidence: new Map(ids.map(storyId => [storyId, { storyId }])), assertCurrent() {} }),
}))
// Stream each variant like the browser channel, then wait out hanging stories.
vi.mock('../test/collect.js', () => ({ collectHistoireProjectTests: vi.fn(async (ctx: Context, options: CollectHistoireTestsOptions) => {
  mounted.push(ctx.storyFiles.map(file => file.story!.id))
  const execution = { runId: options.collectionRunId!, mode: 'server' as const }
  const variants: HistoireProjectTestCollectionResult['variants'] = []
  for (const file of ctx.storyFiles) {
    if (hanging.has(file.story!.id)) {
      await new Promise((_, reject) => options.signal!.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }))
    }
    const entry = { target: { storyId: file.story!.id, variantId: 'default' }, collection: { definitions: [] } }
    variants.push(entry)
    options.onProgress?.({ execution, variants: [entry] })
  }
  return { execution, variants }
}) }))

afterEach(() => {
  vi.restoreAllMocks()
  valid.clear()
  mounted.length = 0
  hanging.clear()
})

/** Two-story dev publication with a live catalog owner. */
async function createProject() {
  const fixture = await createMcpProjectFixture()
  const context = createMcpContext(fixture.root, [createMcpStory(fixture.root, 'a', 'a.story.js'), createMcpStory(fixture.root, 'b', 'b.story.js')])
  context.config = getDefaultConfig()
  const catalog = createRuntimeCatalog({ ...MCP_PROJECT_OPTIONS, root: fixture.root })
  await catalog.publish(context)
  vi.spyOn(attachment, 'getRuntimeCatalogForContext').mockReturnValue({ catalog, ready: Promise.resolve(), close: () => {} })
  /** One project collection request, as the workbench sends on each load. */
  const collect = (signal = new AbortController().signal) => createHistoireTestCollectionTask(context, {}).run(signal)
  return { context, catalog, collect, close: fixture.close }
}

it('keeps stories collected before a cancelled run and mounts only the rest next time', async () => {
  const { collect, close } = await createProject()
  try {
    valid.add('a').add('b')
    hanging.add('b')
    const controller = new AbortController()
    const cancelled = collect(controller.signal)
    await vi.waitFor(() => expect(mounted).toHaveLength(1))
    controller.abort()
    await expect(cancelled).rejects.toBeDefined()
    hanging.clear()

    const result = await collect()

    expect(mounted[1]).toEqual(['b'])
    expect(result.variants.map(entry => entry.target.storyId)).toEqual(['a', 'b'])
  }
  finally { await close() }
})

it('reuses definitions across catalog republishes and remounts only stories with invalid evidence', async () => {
  const { context, catalog, collect, close } = await createProject()
  try {
    valid.add('a').add('b')
    await collect()
    context.storyFiles[1].story!.title = 'Republished'
    await catalog.publish(context)
    valid.delete('a')

    const result = await collect()

    expect(mounted).toEqual([['a', 'b'], ['a']])
    expect(result.execution.revision).toBe(catalog.current!.revision)
    expect(result.variants.map(entry => entry.target.storyId)).toEqual(['a', 'b'])
  }
  finally { await close() }
})
