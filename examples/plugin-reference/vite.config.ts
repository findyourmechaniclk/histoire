import type { Plugin } from 'vite'
import { createRequire } from 'node:module'
import vue from '@vitejs/plugin-vue'
import { compile } from 'svelte/compiler'
import { defineConfig } from 'vitest/config'

/** Part of the Svelte 4 compiler API used here. */
type Svelte4Compile = (source: string, options: { filename: string, css: 'external' }) => { js: { code: string, map: any } }
/** Svelte 4 compiler from the `svelte4` alias package; the default `svelte` is Svelte 5. */
const { compile: compileSvelte4 } = createRequire(import.meta.url)('svelte4/compiler') as { compile: Svelte4Compile }

/** Svelte 4 components of the `svelte4` variant. */
const SVELTE4_FILE = /\/src\/svelte4\/[^/]+\.svelte$/

/**
 * Precompiles Svelte components so consumers need no Svelte tooling: `src/svelte4/` with the
 * Svelte 4 compiler (output imports `svelte/internal`, the project's Svelte 4 runtime), the rest
 * with Svelte 5 (runes, type-only TypeScript). Styles live in the shared stylesheet, so no CSS
 * is emitted here.
 */
function svelte(): Plugin {
  return {
    name: 'reference:svelte',
    transform(code, id) {
      if (SVELTE4_FILE.test(id)) return compileSvelte4(code, { filename: id, css: 'external' }).js
      if (id.endsWith('.svelte')) return compile(code, { filename: id, generate: 'client', css: 'external' }).js
    },
  }
}

/**
 * Tests only: the package's own `svelte` is Svelte 5, so `svelte` imports of the Svelte 4
 * components resolve to the Svelte 4 runtime instead (a Svelte 4 project does this by deduping).
 */
function svelte4Runtime(): Plugin {
  return {
    name: 'reference:svelte4-runtime',
    enforce: 'pre',
    resolveId(id, importer) {
      // Resolved by Vite (browser conditions) from this package's `svelte4` alias.
      if (importer && SVELTE4_FILE.test(importer) && /^svelte(?:\/|$)/.test(id)) return this.resolve(id.replace(/^svelte/, 'svelte4'), importer, { skipSelf: true })
    },
  }
}

/** Runtime packages stay imports: the workbench resolves `vue` and controls to its own copies. */
const EXTERNAL = /^(?:vue|react|react-dom|svelte|@histoire\/(?:plugin-kit|controls))(?:\/|$)/

/**
 * Browser entries (workbench variants and frame module) compiled ahead of time, so installing
 * the package needs no Vue, JSX or Svelte compiler. The Node entry is emitted by `tsc`.
 */
export default defineConfig({
  plugins: [vue(), svelte(), ...process.env.VITEST ? [svelte4Runtime()] : []],
  oxc: { jsx: { runtime: 'automatic' } },
  // Plain CSS: no PostCSS config lookup up the repository tree.
  css: { postcss: {} },
  build: {
    target: 'es2022',
    minify: false,
    lib: {
      formats: ['es'],
      entry: {
        'client/vue': 'src/client/vue.ts',
        'client/dom': 'src/client/dom.ts',
        'client/react': 'src/client/react.ts',
        'client/svelte': 'src/client/svelte.ts',
        'client/svelte4': 'src/client/svelte4.ts',
        'frame': 'src/frame/index.ts',
      },
    },
    rolldownOptions: {
      external: id => EXTERNAL.test(id),
      output: { chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
  // Svelte's `mount` exists in its browser build only; specs opt into jsdom per file.
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    include: ['src/**/*.spec.ts'],
  },
})
