// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject, onUnmounted } from 'vue'
import { createPreviewHost } from '../../../../histoire-plugin-vue/src/client/app/host.js'
import { useRenderContext } from '../../../../histoire-plugin-vue/src/client/app/render-context.js'

const calls = vi.hoisted(() => [] as string[])

vi.mock('virtual:$histoire-generated-global-setup', () => ({ setupVue3: undefined }))
vi.mock('virtual:$histoire-setup', () => ({
  // Stands for app-level integrations such as a Nuxt app and its plugins.
  setupVue3: ({ app }) => {
    calls.push('global setup')
    app.provide('integration', 'app-level')
  },
}))

const hosts: Array<ReturnType<typeof createPreviewHost>> = []

afterEach(() => {
  hosts.splice(0).forEach(host => host.unmount())
  calls.length = 0
  document.body.innerHTML = ''
})

/**
 * Story file standing for `<Story><Variant :setup-app>`: the mount pass
 * configures the variant like plugin-vue's `Variant`, the render pass shows it.
 */
function createStory(configReady: boolean) {
  const variant: any = { id: 'variant', state: {}, configReady }
  const component = defineComponent({
    setup() {
      const { mode } = useRenderContext()!
      calls.push(`${mode} pass: ${inject('integration')}`)
      onUnmounted(() => calls.push(`${mode} pass unmounted`))
      if (mode === 'mount') {
        Object.assign(variant, {
          configReady: true,
          setupApp: ({ app }) => calls.push(`variant setup, app ${app._container ? 'mounted' : 'not mounted'}`),
        })
      }
      return () => mode === 'render' ? h('span', { 'data-variant': '' }) : null
    },
  })
  return { story: { id: 'story', variants: [variant], file: { component } } as any, variant }
}

/** Mounts the variant in a render host that configures the story itself. */
async function renderVariant(configReady: boolean) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const { story, variant } = createStory(configReady)
  const host = createPreviewHost({
    name: 'TestHost',
    el,
    getStory: () => story,
    getVariant: () => variant,
    renderContext: { mode: 'render', slotName: 'default', currentVariant: variant, externalState: {}, nextVariantIndex: { value: 0 } } as any,
    configureStory: true,
  })
  hosts.push(host)
  await host.mount()
  return { el, host }
}

describe('vue preview host story configuration', () => {
  it('configures variants in its own app before the variant setup, booting app integrations once', async () => {
    const { el, host } = await renderVariant(false)
    expect(calls).toEqual([
      'global setup',
      'mount pass: app-level',
      'variant setup, app not mounted',
      'render pass: app-level',
    ])
    expect(el.querySelectorAll('[data-variant]')).toHaveLength(1)
    host.unmount()
    expect(calls).toContain('mount pass unmounted')
  })

  it('skips the mount pass for configured variants', async () => {
    await renderVariant(true)
    expect(calls).toEqual(['global setup', 'render pass: app-level'])
  })
})
