import type { Plugin } from 'vite'
import type { Context } from '../../context.js'
import type { CollectionModuleAnalysis } from './analysis.js'
import { AsyncLocalStorage } from 'node:async_hooks'
import { analyzeCollectionModule } from './analysis.js'

/** Proof transforms stop before browser-only URL rewriting; concurrent HTTP requests remain untouched. */
const proofTransform = new AsyncLocalStorage<{ ctx: Context, id: string, complete: Error, code?: string, watchFiles?: string[] }>()
/** Analysis of a remembered transform, parsed on first read and kept. */
type RememberedAnalysis = () => CollectionModuleAnalysis

/**
 * Reuse actual client transforms; retain parsed capability, never collection
 * results. Ordinary transforms keep their output (the string Vite's module
 * graph already holds) until a proof reads it: most modules never are.
 */
const analyses = new WeakMap<Context, { ordinary: boolean, modules: Map<string, RememberedAnalysis> }>()

/** A captured object acts as generation token while transforms await user plugins. */
function current(ctx: Context) {
  let state = analyses.get(ctx)
  if (!state) {
    state = { ordinary: true, modules: new Map() }
    analyses.set(ctx, state)
  }
  return state
}

/** Dependency and plugin changes revoke transformed capability alongside resolved graph proofs. */
export function retireCollectionTransforms(ctx: Context): void {
  // Served transforms can finish after HMR from retired bytes. Following the
  // first edit, only an explicitly captured proof transform may fill this cache.
  analyses.set(ctx, { ordinary: false, modules: new Map() })
}

/**
 * Files earlier plugins read while transforming this module (e.g. types
 * resolved by `@vitejs/plugin-vue` for `defineProps`). Vite keeps them on the
 * private `_addedImports` of the transform context; without it they stay untracked.
 * @param context Transform plugin context of the current hook call.
 */
function getWatchFiles(context: unknown): string[] | undefined {
  const added = (context as { _addedImports?: unknown } | undefined)?._addedImports
  return added instanceof Set && added.size ? [...added].filter((file): file is string => typeof file === 'string') : undefined
}

/** Store only the same pre-import-analysis output inspected by isolated proof transforms. */
function remember(ctx: Context, id: string, code: string, state = current(ctx), watchFiles?: string[]): RememberedAnalysis {
  let analysis: CollectionModuleAnalysis | undefined
  const read = () => analysis ??= { ...analyzeCollectionModule(code), ...(watchFiles?.length ? { watchFiles } : {}) }
  if (analyses.get(ctx) === state) state.modules.set(id, read)
  return read
}

/** Capture user/plugin output without evaluating it or changing the served module. */
export function collectionEligibilityTransformPlugin(ctx: Context): Plugin {
  return {
    name: 'histoire-test-eligibility-transforms',
    enforce: 'post',
    transform(code, id) {
      const proof = proofTransform.getStore()
      if (proof?.ctx === ctx && proof.id === id) {
        proof.code = code
        proof.watchFiles = getWatchFiles(this)
        throw proof.complete
      }
      if (current(ctx).ordinary) remember(ctx, id, code, undefined, getWatchFiles(this))
    },
  }
}

/** Run the same client transforms, stopping at captured user output rather than optimizer transport. */
export async function transformCollectionEligibility(ctx: Context, id: string, transform: () => Promise<unknown>, signal?: AbortSignal): Promise<CollectionModuleAnalysis | undefined> {
  const state = current(ctx)
  const cached = state.modules.get(id)
  if (cached) return cached()
  const complete = new Error('Collection eligibility transform complete')
  const proof: NonNullable<ReturnType<typeof proofTransform.getStore>> = { ctx, id, complete }
  try {
    await proofTransform.run(proof, transform)
  }
  catch (error) { if (error !== complete) throw error }
  return signal?.aborted || proof.code === undefined ? undefined : remember(ctx, id, proof.code, state, proof.watchFiles)()
}
