import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import { defineRuntimeBundleConfig } from '../../scripts/vite-runtime-bundle.mjs'

/**
 * Modules the bundles must import as built files: generated stories import
 * them too, so inlining them would give the document a second instance.
 */
const SHARED_MODULES = ['generated-story-metadata']

/** Source directory mirrored by the `tsc` output in `dist/node`. */
const SOURCE_DIR = fileURLToPath(new URL('./src/node/', import.meta.url))

/**
 * Browser runtimes the generated sandbox and test harness modules import,
 * bundled next to the `tsc` output (see the helper).
 */
export default defineRuntimeBundleConfig({
  name: 'histoire:runtime',
  outDir: 'dist/browser',
  entries: {
    'variant-test-session/index': 'src/node/virtual/variant-test-session/index.ts',
    'vitest-static-mock-runtime/index': 'src/node/virtual/vitest-static-mock-runtime/index.ts',
  },
  externalPath(id, importer) {
    if (!importer || !id.startsWith('.')) return
    const name = SHARED_MODULES.find(module => id.endsWith(`/${module}.js`))
    if (!name) return
    const source = resolve(dirname(importer), id)
    // Entries are emitted two levels below `dist/browser`, next to `dist/node`.
    if (source === resolve(SOURCE_DIR, `${name}.js`)) return `../../node/${name}.js`
  },
})
