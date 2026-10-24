import type { ReferenceUi } from 'histoire-example-plugin-reference'
import { HstVue } from '@histoire/plugin-vue'
import { defineConfig, getDefaultConfig } from 'histoire'
import { referencePlugin } from 'histoire-example-plugin-reference'

export default defineConfig({
  visual: {},
  ui: { frameBudget: 12 },
  // outDir: 'hdist',
  plugins: [
    HstVue(),
    // Reference workbench plugin with React views in a Vue project. Try another variant with
    // HISTOIRE_REFERENCE_UI=vue|dom|svelte.
    referencePlugin({ ui: (process.env.HISTOIRE_REFERENCE_UI as ReferenceUi | undefined) ?? 'react', minTargetSize: 40 }),
  ],
  backgroundPresets: [
    ...(getDefaultConfig().backgroundPresets || []),
    {
      label: 'Custom gray',
      color: '#cafff5',
      contrastColor: '#005142',
    },
  ],
  // autoApplyContrastColor: true,
  // routerMode: 'hash',
  theme: {
    darkClass: 'my-dark',
  },
})
