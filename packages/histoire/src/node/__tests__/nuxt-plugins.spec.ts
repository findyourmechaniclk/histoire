import { describe, expect, it } from 'vitest'
import { excludeAppPlugins } from '../../../../histoire-plugin-nuxt/src/plugins.js'
import { releaseRouterLink, selectStoryPlugins } from '../../../../histoire-plugin-nuxt/src/runtime/plugins.js'

/** Nuxt plugin as `defineNuxtPlugin` returns it at runtime. */
function plugin(name?: string) {
  return Object.assign(() => {}, { _name: name })
}

describe('plugin-nuxt app plugins', () => {
  it('excludes app plugins matching a path fragment or pattern', () => {
    const plugins = [
      { src: '/app/plugins/offlineSync.ts' },
      { src: 'C:\\app\\plugins\\plausible.client.ts' },
      { src: '/node_modules/@nuxt/content/dist/runtime/plugins/websocket.dev.js' },
      { src: '/app/plugins/i18n.ts' },
    ]
    expect(excludeAppPlugins(plugins, ['/plugins/offlineSync.ts', 'app/plugins/plausible', /@nuxt\/content\/.*websocket/]))
      .toEqual([{ src: '/app/plugins/i18n.ts' }])
    expect(excludeAppPlugins(plugins, [])).toEqual(plugins)
  })

  it('skips Nuxt diagnostics about layouts, and the Vapor interop during collection', () => {
    const layout = plugin('nuxt:checkIfLayoutUsed')
    const vapor = plugin('nuxt:vapor-interop')
    const anonymous = plugin()
    const i18n = plugin('i18n:plugin')
    expect(selectStoryPlugins([layout, vapor, anonymous, i18n], false)).toEqual([vapor, anonymous, i18n])
    expect(selectStoryPlugins([layout, vapor, anonymous, i18n], true)).toEqual([anonymous, i18n])
  })

  it('releases the RouterLink stub so Nuxt registers its own without a warning', () => {
    const stub = {}
    const other = {}
    const app = { _context: { components: { RouterLink: stub, Other: other } } }
    releaseRouterLink(app)
    expect(app._context.components).toEqual({ Other: other })
  })
})
