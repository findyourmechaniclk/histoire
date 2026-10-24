import { defineRuntimeBundleConfig } from '../../scripts/vite-runtime-bundle.mjs'

/** One module per document instead of one per source file (see the helper). */
export default defineRuntimeBundleConfig({
  name: 'shared',
  entries: {
    'index': 'src/index.ts',
    // Imported by path (`@histoire/shared/dist/icons/index.js`) by the controls.
    'icons/index': 'src/icons/index.ts',
  },
})
