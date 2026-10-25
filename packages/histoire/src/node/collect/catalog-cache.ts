import type { ServerStoryFile } from '@histoire/shared'
import type { Context } from '../context.js'
import type { StoryCollectionOutcome } from './outcome.js'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { deserialize, serialize } from 'node:v8'
import fs from 'fs-extra'
import { join, relative, resolve } from 'pathe'
import { resolveConfigFile } from '../config/load.js'
import { isPathWithinRoot, readRegisteredText } from '../runtime/content/files.js'
import { hashContent } from '../runtime/content/hash.js'
import { captureInlineDocs, getInlineDocs } from '../runtime/content/inline.js'
import { getContextRegistry } from '../runtime/registry.js'
import { markGeneratedDir } from '../util/generated-dir.js'
import { getProjectCacheDir } from '../util/temp-paths.js'

/** Bumped whenever the stored shape or the meaning of a stored outcome changes. */
const FORMAT = 1

/** Stored outcome of one story file; failed files are never stored. */
interface CacheEntry {
  status: 'collected' | 'empty'
  sourceSha256: string
  /** Raw collected metadata, before `finalizeCollectedStoryFile`. */
  story?: StoryCollectionOutcome['story']
  /** Inline docs captured while the story file was transformed, read by catalog docs. */
  inlineDocs?: ReturnType<typeof getInlineDocs>
}

/** Whole cache file: entries are only valid under the same key. */
interface CacheData {
  key: string
  entries: [string, CacheEntry][]
}

/** Last collection outcome of every story file, reused when the dev server starts again. */
export interface CollectionCache {
  /**
   * Cached outcomes keyed by story file path, or `undefined` unless every given
   * story file has an entry for its current source. Inline docs of the cached
   * stories are captured again, as no transform of this run produced them yet.
   */
  read: (storyFiles: ServerStoryFile[]) => Promise<Map<string, StoryCollectionOutcome> | undefined>
  /** Replaces the cache with these outcomes; failed and unhashed files are left out. */
  write: (storyFiles: ServerStoryFile[], outcomes: ReadonlyMap<string, StoryCollectionOutcome>) => Promise<void>
}

/**
 * Fingerprint of a story file's registered source (module code of virtual
 * stories), `undefined` when it can't be read.
 */
export async function readStorySourceSha256(ctx: Context, storyFile: ServerStoryFile): Promise<string | undefined> {
  try {
    return storyFile.virtual ? hashContent(storyFile.moduleCode ?? '') : (await readRegisteredText(ctx.root, storyFile.path)).sha256
  }
  catch {
    // Content availability does not change trusted collection policy.
    // Unavailable source is diagnosed by the catalog projector.
    return undefined
  }
}

/** Histoire's own version: collection code of another release may produce other metadata. */
async function readHistoireVersion(): Promise<string> {
  try {
    // `src/node/collect` and `dist/node/collect` are both three levels below the package root.
    return JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8')).version ?? ''
  }
  catch {
    return ''
  }
}

/**
 * Cache of the dev story catalog in `.histoire/cache/collection`. It only
 * spares the wait for a first collection: the dev server still collects every
 * story again in the background and publishes any difference.
 */
export function createCollectionCache(ctx: Context, file = resolve(getProjectCacheDir(ctx.root), 'collection', 'stories.bin')): CollectionCache {
  const tempDir = getContextRegistry(ctx).tempDir
  let key: Promise<string> | undefined

  /** Generated stories live in a per-run temp dir; match them by their path inside it. */
  function getEntryId(storyFile: ServerStoryFile) {
    return isPathWithinRoot(tempDir, storyFile.path) ? `run:${relative(tempDir, storyFile.path)}` : storyFile.relativePath
  }

  /** Config and Histoire release, as far as they can be read without running anything. */
  function getKey() {
    return key ??= (async () => {
      const configFile = resolveConfigFile(ctx.root, ctx.configFile)
      const config = configFile ? await readFile(configFile, 'utf8').catch(() => '') : ''
      const plugins = ctx.config.plugins?.map(plugin => plugin.name) ?? []
      return hashContent(JSON.stringify([FORMAT, await readHistoireVersion(), config, plugins]))
    })()
  }

  async function read(storyFiles: ServerStoryFile[]) {
    let data: CacheData
    try {
      data = deserialize(await readFile(file)) as CacheData
    }
    catch {
      return undefined
    }
    if (data?.key !== await getKey() || !Array.isArray(data.entries)) return undefined
    const entries = new Map(data.entries)
    const outcomes = new Map<string, StoryCollectionOutcome>()
    for (const storyFile of storyFiles) {
      const entry = entries.get(getEntryId(storyFile))
      if (!entry || entry.sourceSha256 !== await readStorySourceSha256(ctx, storyFile)) return undefined
      outcomes.set(storyFile.path, { status: entry.status, sourceSha256: entry.sourceSha256, ...(entry.story ? { story: entry.story } : {}) })
    }
    for (const storyFile of storyFiles) {
      const { inlineDocs } = entries.get(getEntryId(storyFile))!
      if (inlineDocs) captureInlineDocs(ctx, storyFile.path, inlineDocs)
    }
    return outcomes
  }

  async function write(storyFiles: ServerStoryFile[], outcomes: ReadonlyMap<string, StoryCollectionOutcome>) {
    const entries: CacheData['entries'] = []
    for (const storyFile of storyFiles) {
      const outcome = outcomes.get(storyFile.path)
      if (!outcome?.sourceSha256) continue
      const inlineDocs = getInlineDocs(ctx, storyFile.path, outcome.sourceSha256)
      if (outcome.status === 'collected' && outcome.story) entries.push([getEntryId(storyFile), { status: 'collected', sourceSha256: outcome.sourceSha256, story: outcome.story, ...(inlineDocs ? { inlineDocs: { ...inlineDocs } } : {}) }])
      else if (outcome.status === 'empty') entries.push([getEntryId(storyFile), { status: 'empty', sourceSha256: outcome.sourceSha256 }])
    }
    const data: CacheData = { key: await getKey(), entries }
    // Another dev server of the same project may read it at any time:
    // publish the whole file at once.
    const temp = join(file, '..', `.stories-${randomUUID()}.tmp`)
    markGeneratedDir(getProjectCacheDir(ctx.root))
    await fs.ensureDir(join(file, '..'))
    await fs.writeFile(temp, serialize(data))
    await fs.rename(temp, file)
  }

  return { read, write }
}
