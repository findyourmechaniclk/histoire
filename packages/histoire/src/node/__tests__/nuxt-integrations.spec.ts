// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createNuxtFetch } from '../../../../histoire-plugin-nuxt/src/runtime/fetch.js'
import { createUiAppWrapper } from '../../../../histoire-plugin-nuxt/src/runtime/ui-app.js'
import { createSetupCode } from '../../../../histoire-plugin-nuxt/src/setup-code.js'
import { findUiAppComponent } from '../../../../histoire-plugin-nuxt/src/ui-app.js'

describe('plugin-nuxt integrations', () => {
  it('finds the Nuxt UI app component with the configured prefix', () => {
    const components = [
      { pascalName: 'UButton', filePath: '/ui/Button.vue' },
      { pascalName: 'NuiApp', filePath: '/ui/App.vue' },
      { pascalName: 'App', filePath: '/app/App.vue' },
    ]
    expect(findUiAppComponent(components, 'Nui')).toBe('/ui/App.vue')
    expect(findUiAppComponent(components, undefined)).toBeUndefined()
    expect(findUiAppComponent([{ pascalName: 'UApp', filePath: '/ui/App.vue' }], undefined)).toBe('/ui/App.vue')
  })

  it('renders stories inside the UI app without forwarding wrapper props', async () => {
    const UiApp = defineComponent({
      setup: (_, { slots, attrs }) => () => h('section', { 'data-attrs': Object.keys(attrs).join(',') }, slots.default?.()),
    })
    const Wrapper = createUiAppWrapper(UiApp)
    const el = document.createElement('div')
    createApp({ render: () => h(Wrapper, { story: {}, variant: {} }, () => h('p', 'story')) }).mount(el)
    await nextTick()
    expect(el.innerHTML).toBe('<section data-attrs=""><p>story</p></section>')
  })

  it('reads window.fetch on each request, so later fetch mocks answer $fetch', async () => {
    const win = { fetch: vi.fn(), Headers } as any
    const $fetch = createNuxtFetch(win)
    win.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }))
    await expect($fetch('http://localhost/api/session')).resolves.toEqual({ ok: true })
    expect(win.fetch).toHaveBeenCalledTimes(1)
  })

  it('generates the setup code with the detected integrations only', () => {
    const base = { css: ['~/main.css'], publicConfig: { a: 1 }, appConfig: { baseURL: '/' } }
    const [css, plain] = createSetupCode(base)
    expect(css).toBe(`import '~/main.css'`)
    expect(plain).not.toContain('color-mode-options')
    expect(plain).toContain('await setupNuxtApp({"a":1}, setupApi, { ...{"baseURL":"/"}, baseURL: import.meta.env.BASE_URL }, {})')

    const [, full] = createSetupCode({ ...base, colorMode: true, uiApp: '/ui/App.vue' })
    expect(full).toContain(`import * as colorModeOptions from '#build/color-mode-options.mjs'`)
    expect(full).toContain(`import UiApp from "/ui/App.vue"`)
    expect(full).toContain('{ colorMode: colorModeOptions, uiApp: UiApp }')
  })
})
