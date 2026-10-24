import { defineRuntimeBundleConfig } from '../../scripts/vite-runtime-bundle.mjs'

/** One module per document instead of one per source file (see the helper). */
export default defineRuntimeBundleConfig({
  name: 'protocol',
  entries: { index: 'src/index.ts' },
})
