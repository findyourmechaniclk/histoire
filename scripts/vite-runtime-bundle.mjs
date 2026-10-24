import { isAbsolute } from 'node:path'
import { rolldownWatchOptions } from './vite-watch.mjs'

/**
 * Whether a specifier names another package or a virtual/builtin module, which
 * a runtime bundle must import instead of inlining.
 * @param {string} id Import specifier as written in source.
 */
function isPackageSpecifier(id) {
  return !id.startsWith('.') && !isAbsolute(id) && !id.startsWith('\0')
}

/**
 * Vite config bundling a package's browser runtime into a few ES modules.
 *
 * Every story sandbox is its own document and imports these runtimes again.
 * Served file by file (plain `tsc` output), they cost dozens of module requests
 * per document; bundled, one or two. Each entry stays the only copy of its
 * modules, and other packages stay external, so a document still evaluates
 * exactly one instance of every stateful module (`@histoire/shared` state,
 * Vue, virtual modules resolved per project).
 * @param {object} options Bundle options.
 * @param {string} options.name Label prefixed to watch rebuild logs.
 * @param {Record<string, string>} options.entries Output name (without `.js`) to source entry.
 * @param {string} [options.outDir] Output directory, `dist` by default.
 * @param {(id: string, importer: string | undefined) => string | undefined} [options.externalPath]
 *   Keeps a relative import external, for modules other built files import too
 *   (inlining them would make a second instance). Returns the specifier the
 *   bundle keeps, relative to the emitted entry; Rolldown leaves it unchanged.
 * @returns {import('vite').UserConfig} Plain config: this shared script cannot
 *   import `vite`, which only the packages depend on.
 */
export function defineRuntimeBundleConfig({ name, entries, outDir = 'dist', externalPath }) {
  return {
    plugins: externalPath
      ? [{
          name: 'histoire:runtime-bundle-external-path',
          enforce: 'pre',
          resolveId(id, importer) {
            const path = externalPath(id, importer)
            return path ? { id: path, external: true } : null
          },
        }]
      : [],
    build: {
      watch: rolldownWatchOptions(name),
      // Declarations (and other entries) live next to the bundles.
      emptyOutDir: false,
      outDir,
      minify: false,
      target: 'esnext',
      lib: {
        entry: entries,
        formats: ['es'],
        fileName: (_format, entryName) => `${entryName}.js`,
      },
      rolldownOptions: {
        external: isPackageSpecifier,
        // Same module semantics as the unbundled output: keep every statement.
        treeshake: false,
        preserveEntrySignatures: 'strict',
        output: {
          chunkFileNames: 'chunks/[name]-[hash].js',
        },
      },
    },
  }
}
