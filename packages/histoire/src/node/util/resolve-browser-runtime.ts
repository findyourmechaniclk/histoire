import { fileURLToPath } from 'node:url'

/** Browser runtimes bundled by `vite.runtime.config.ts`. */
export type BrowserRuntimeName = 'variant-test-session' | 'vitest-static-mock-runtime'

/**
 * Resolves the bundled entry of a browser runtime that generated modules
 * import by absolute path.
 *
 * Each sandbox document loads them again: the bundle is one module where the
 * `tsc` output of the same sources is about thirty. The path is the same from
 * `src/node/util` (specs) and `dist/node/util` (published), so both read the
 * built bundle.
 * @param name Runtime directory name, shared by its source and bundle.
 */
export function resolveBrowserRuntimeEntry(name: BrowserRuntimeName): string {
  return fileURLToPath(new URL(`../../../dist/browser/${name}/index.js`, import.meta.url))
}
