import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

/**
 * Client-only libraries Nuxt modules add to `build.transpile` (Nuxt UI: `reka-ui`).
 * Nuxt keeps transpiled packages out of dependency optimization, and Vite never
 * discovers imports made from other packages, so they stay as hundreds of raw
 * modules: a Nuxt page pays that once, every Histoire story frame pays again.
 */
const KNOWN_CLIENT_LIBRARIES = ['reka-ui', 'radix-vue']

interface OptimizeDepsLists {
  include?: string[]
  exclude?: string[]
}

/**
 * Directory of `dep` installed in the `node_modules` chain of `fromDir`.
 * Node's own resolution also reads `NODE_PATH` (set by pnpm bin shims), which
 * Vite ignores, so a package found there would still fail Vite's resolution.
 */
function findPackageDir(fromDir: string, dep: string): string | null {
  let dir = fromDir
  while (true) {
    if (basename(dir) !== 'node_modules') {
      const candidate = join(dir, 'node_modules', dep)
      if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate)
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * `optimizeDeps.include` id reaching `dep` from the project root: the bare
 * name when it is installed there, else Vite's nested `parent > dep` form
 * through a direct dependency (pnpm installs `reka-ui` under `@nuxt/ui` only).
 * @param root Project root containing `package.json`
 * @param dep Package name
 * @returns Include id, or `null` when no direct dependency reaches it
 */
export function resolveIncludeId(root: string, dep: string): string | null {
  if (findPackageDir(root, dep)) return dep
  let manifest: { dependencies?: Record<string, string>, devDependencies?: Record<string, string> }
  try {
    manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  }
  catch {
    return null
  }
  for (const parent of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    const parentDir = findPackageDir(root, parent)
    if (parentDir && findPackageDir(parentDir, dep)) return `${parent} > ${dep}`
  }
  return null
}

/**
 * Pre-bundles known client-only transpiled libraries, plus `extra`.
 * @param optimizeDeps Nuxt's client `optimizeDeps`
 * @param transpile Nuxt's `build.transpile`
 * @param extra Packages the user asked to pre-bundle
 * @param toIncludeId Maps a package to its include id, `null` when unreachable
 * @returns Lists with those packages moved from `exclude` to `include`
 */
export function prebundleTranspiledDeps<T extends OptimizeDepsLists>(
  optimizeDeps: T,
  transpile: unknown[],
  extra: string[],
  toIncludeId: (dep: string) => string | null,
): T {
  const deps = [...KNOWN_CLIENT_LIBRARIES.filter(dep => transpile.includes(dep)), ...extra]
  const prebundled = deps.map(dep => [dep, toIncludeId(dep)] as const).filter(([, id]) => id)
  if (!prebundled.length) return optimizeDeps
  const names = prebundled.map(([dep]) => dep)
  return {
    ...optimizeDeps,
    include: [...new Set([...optimizeDeps.include ?? [], ...prebundled.map(([, id]) => id!)])],
    exclude: optimizeDeps.exclude?.filter(dep => !names.includes(dep)),
  }
}
