# Vue DevTools plugin

`@histoire/plugin-vue-devtools` adds the Devframe-based Vue DevTools to the right inspector in development. Select a story variant and open the **Vue DevTools** tab to inspect its Vue component tree and state. The floating Devframe toolbar is disabled. The inspector frames the upstream UI using `degradedVisualIntegration`. It requires Vue 3.5.26 or later, Vite 8.3 or later, and `@vitejs/devtools` 0.8.0. Vue DevTools is pinned to 9.0.0-rc.2.

```ts
import { HstVue } from '@histoire/plugin-vue'
import { HstVueDevtools } from '@histoire/plugin-vue-devtools'
import { defineConfig } from 'histoire'

export default defineConfig({
  plugins: [HstVue(), HstVueDevtools()],
})
```

The plugin respects an explicit `devtools: false` Vite configuration. It is inactive during builds, collection and browser test runtimes. Vue DevTools' own MCP endpoint is disabled; the separately authenticated `@histoire/devframe` adapter can expose Histoire live inspection.

The inspector connects to the selected same-origin story frame. Embedded story-only surfaces have no workbench inspector and do not show the toolbar. For a controlled local host, `clientAuthToken` can provide a pre-approved secret of 32–512 printable ASCII characters with no spaces for DevTools server access. The plugin embeds that secret in served documents and therefore rejects requests unless the actual source listener is bound to loopback; it also pins the DevTools host to loopback. Only supply a fresh secret in a trusted local development environment, and do not use this option with a public server. `enabled: false` disables the plugin.

See the [Vue 3 Devframe example](../../examples/vue3/devframe/README.md) for a runnable host and browser test. The example is local-only and is not a production authentication design.
