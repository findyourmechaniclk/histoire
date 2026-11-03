import { defineRuntimeBundleConfig } from '../../scripts/vite-runtime-bundle.mjs'

/** Standalone browser assets never depend on a project's Vite server. */
export default defineRuntimeBundleConfig({
  name: 'histoire:dev-proxy',
  outDir: 'dist/browser',
  entries: { lifecycle: 'src/client/lifecycle.ts', demo: 'src/client/demo.ts' },
})
