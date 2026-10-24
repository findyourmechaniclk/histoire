import type { Plugin } from 'vite'
import { compile as compileSvelte4 } from 'svelte4/compiler'
import { compile as compileSvelte5 } from 'svelte/compiler'
import { defineConfig } from 'vitest/config'

/**
 * Compiles adapter test fixtures: `*.v4.svelte` with Svelte 4 (internals imported from the
 * `svelte4` alias package), `*.v5.svelte` with Svelte 5.
 */
function svelteFixtures(): Plugin {
  return {
    name: 'plugin-kit:svelte-fixtures',
    transform(code, id) {
      if (id.endsWith('.v4.svelte')) return compileSvelte4(code, { filename: id, sveltePath: 'svelte4' }).js
      if (id.endsWith('.v5.svelte')) return compileSvelte5(code, { filename: id, generate: 'client' }).js
    },
  }
}

export default defineConfig({
  plugins: [svelteFixtures()],
  // Svelte's `mount` exists in its browser build only; DOM specs opt into jsdom per file.
  resolve: { conditions: ['browser'] },
})
