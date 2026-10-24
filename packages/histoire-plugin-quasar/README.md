# Histoire + Quasar CLI

Integrates [Quasar CLI](https://quasar.dev/start/quasar-cli) projects using `@quasar/app-vite`: it reads `quasar.config` (App Extensions included), loads Quasar styles and `framework` options, installs the project store and runs client boot files.

```bash
pnpm add -D @histoire/plugin-vue @histoire/plugin-quasar
```

Add the plugins in `histoire.config.ts`:

```js
import { HstQuasar } from '@histoire/plugin-quasar'
import { HstVue } from '@histoire/plugin-vue'
import { defineConfig } from 'histoire'

export default defineConfig({
  storyMatch: ['src/**/*.story.vue'],
  plugins: [
    HstVue(),
    HstQuasar(),
  ],
})
```

[Documentation](https://histoire.dev/guide/vue3/getting-started.html#quasar-cli)
