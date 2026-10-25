import type { Context } from '../context.js'
import { join, relative, resolve } from 'pathe'
import { getContextRegistry } from '../runtime/registry.js'
import { markGeneratedDir } from '../util/generated-dir.js'
import { claimPersistentDir } from '../util/persistent-dir.js'
import { getProjectCacheDir } from '../util/temp-paths.js'

/** Persistent dev client optimizer caches, claimed once per context. */
const devClientCacheDirs = new WeakMap<Context, string>()

/**
 * Vite cache directory of one Histoire server.
 *
 * The dev client keeps its optimized dependencies in `.histoire/cache/vite/dev-client`
 * so `histoire dev` restarts reuse them instead of re-optimizing (and reloading
 * open frames) every time. Another live dev context of the same project keeps
 * a run-owned directory, like every other server kind (collection, build, tests).
 * @param ctx The histoire context.
 * @param kind Server kind, e.g. `client` or `server`.
 */
export function getViteCacheDir(ctx: Context, kind: string) {
  const runDir = join(getContextRegistry(ctx).tempDir, 'vite', kind)
  if (ctx.mode !== 'dev' || kind !== 'client') return runDir
  let dir = devClientCacheDirs.get(ctx)
  if (!dir) {
    markGeneratedDir(getProjectCacheDir(ctx.root))
    const persistent = resolve(getProjectCacheDir(ctx.root), 'vite', 'dev-client')
    const release = claimPersistentDir(persistent)
    if (release) getContextRegistry(ctx).cleanup.add(release)
    dir = release ? persistent : runDir
    devClientCacheDirs.set(ctx, dir)
  }
  return dir
}

/**
 * Optimizer entries for story code: the browser setup file and every story
 * glob. Stories are only imported dynamically from virtual modules the
 * optimizer cannot crawl, so without them each newly opened story discovers
 * its dependencies at runtime and reloads open frames.
 * @param ctx The histoire context.
 */
export function getStoryOptimizerEntries(ctx: Context): string[] {
  // Vite resolves entry globs from its own root.
  const base = relative(ctx.resolvedViteConfig.root, ctx.root)
  const fromRoot = (pattern: string) => base ? join(base, pattern) : pattern
  const setup = ctx.config.setupFile
  const setupFile = typeof setup === 'string' ? setup : setup && 'browser' in setup ? setup.browser : undefined
  return [
    ...setupFile ? [fromRoot(setupFile)] : [],
    ...ctx.config.storyMatch.map(fromRoot),
    ...ctx.config.storyIgnored.map(pattern => `!${fromRoot(pattern)}`),
  ]
}
