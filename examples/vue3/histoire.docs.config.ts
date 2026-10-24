import { defineConfig, getDefaultConfig } from 'histoire'
import config from './histoire.config'

/** Public docs book shares real examples without stress and failure fixtures. */
export default defineConfig({
  ...config,
  // The public demo keeps the built-in workbench only.
  plugins: config.plugins?.filter(plugin => plugin.name !== 'histoire-example-plugin-reference'),
  outDir: '../../docs/public/demo',
  // Hash routing keeps copied story links working on plain static hosts.
  routerMode: 'hash',
  vite: { base: '/demo/' },
  storyMatch: [
    'src/components/{Introduction,BaseButton,CodeGen,Controls,Demo,Docs,EventButton,Responsive,PiniaStore,WorkbenchMatrix}.story.vue',
  ],
  storyIgnored: [...getDefaultConfig().storyIgnored, 'src/LongFile*.story.md'],
})
