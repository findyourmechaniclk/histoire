import type { HistoireProjectTestCollectionResult } from '@histoire/protocol'
import type { ServerStoryFile } from '@histoire/shared'
import type { Context } from '../context.js'
import type { CollectionEvidence } from './eligibility/evidence.js'

/** Detached variant definitions of one collection. */
type CollectedVariants = HistoireProjectTestCollectionResult['variants']

/** One story's complete definitions and the dependency evidence they were mounted from. */
interface CachedStory {
  /** Complete successful variant inventory. */
  variants: CollectedVariants
  /** Proof captured before the mount; revalidated on every reuse. */
  evidence: CollectionEvidence
}

/**
 * Definitions outlive catalog republishes and unrelated edits: each story
 * carries its own dependency evidence instead of one shared generation.
 */
interface CollectionCache {
  /** Cached definitions keyed by story ID. */
  stories: Map<string, CachedStory>
  /** Stable scan roots for one story inventory; never mounted by cache admission. */
  optimizer?: { inventory: string, entries: string[] }
}

/** Live context ownership prevents cache evidence crossing config restarts or projects. */
const caches = new WeakMap<Context, CollectionCache>()

/**
 * Read/write detached definitions without retaining any browser, handler, or runner resource.
 * @param ctx Context owning the cache.
 * @param source Catalog publication of the operation; no publication, no reuse.
 * @param verify Revalidates one story's dependency evidence; absent without an eligibility service.
 * @param inventory Current story files of the operation snapshot.
 */
export function getTestCollectionCache(ctx: Context, source: object | undefined, verify: ((evidence: CollectionEvidence) => Promise<boolean>) | undefined, inventory: ServerStoryFile[]) {
  if (!source || !verify) return undefined
  let cache = caches.get(ctx)
  if (!cache) {
    cache = { stories: new Map() }
    caches.set(ctx, cache)
  }
  const owned = cache
  const executable = inventory.filter(file => file.story && !file.story.docsOnly)
  const stories = new Map(executable.map(file => [file.story!.id, file.story!]))
  for (const id of owned.stories.keys()) {
    if (!stories.has(id)) owned.stories.delete(id)
  }
  /** Exactly the story's current variants, all collected without error. */
  function complete(id: string, entries: CollectedVariants): boolean {
    const story = stories.get(id)
    if (!story || entries.length !== story.variants.length || entries.some(entry => entry.collection.error)) return false
    return story.variants.every(variant => entries.some(entry => entry.target.variantId === variant.id))
  }
  return {
    /** Cache misses may shrink without resetting Vite's existing dependency cache; inventory changes re-scan. */
    captureOptimizerEntries(entries: string[]): string[] {
      const key = executable.map(file => file.path).sort().join('\n')
      if (owned.optimizer?.inventory !== key) owned.optimizer = { inventory: key, entries: [...entries] }
      return [...owned.optimizer.entries]
    },
    /** Forced refresh, changed variants, and invalid evidence remove entries before new mounts. */
    async read(ids: string[], force = false): Promise<CollectedVariants> {
      const hits = await Promise.all(ids.map(async (id) => {
        const entry = owned.stories.get(id)
        if (!entry) return []
        if (!force && complete(id, entry.variants) && await verify(entry.evidence)) return structuredClone(entry.variants)
        // A concurrent admission may have replaced the entry while verifying.
        if (owned.stories.get(id) === entry) owned.stories.delete(id)
        return []
      }))
      return hits.flat()
    },
    /**
     * Caller confirms cancellation and provenance before this atomic admission.
     * @param variants Collected entries; stories missing a variant are skipped.
     * @param evidence Proofs of stories eligible for reuse.
     * @param assertCurrent Publication fence of the operation.
     */
    write(variants: CollectedVariants, evidence: ReadonlyMap<string, CollectionEvidence>, assertCurrent: () => void) {
      const admitted = new Map<string, CachedStory>()
      for (const [id, proof] of evidence) {
        const entries = variants.filter(entry => entry.target.storyId === id)
        if (complete(id, entries)) admitted.set(id, { variants: structuredClone(entries), evidence: proof })
      }
      // Cloning can consume the final budget synchronously. Fence after all
      // detached evidence is prepared, before admitting any story atomically.
      assertCurrent()
      for (const [id, entry] of admitted) owned.stories.set(id, entry)
    },
  }
}
