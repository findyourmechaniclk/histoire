// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createPreviewHost } from '../../../../histoire-plugin-vue/src/client/app/host.js'

/** Wrapper standing for app-level providers, e.g. Nuxt UI `UApp` rendering shared overlays. */
const Wrapper = defineComponent({
  setup: (_props, { slots }) => () => h('div', { 'data-wrapper': '' }, slots.default?.()),
})

vi.mock('virtual:$histoire-generated-global-setup', () => ({ setupVue3: undefined }))
vi.mock('virtual:$histoire-setup', () => ({
  setupVue3: ({ addWrapper }) => addWrapper(Wrapper),
}))

const hosts: Array<ReturnType<typeof createPreviewHost>> = []

afterEach(() => {
  hosts.splice(0).forEach(host => host.unmount())
  document.body.innerHTML = ''
})

/** Mounts a story file in a preview host with the given render mode. */
async function mountHost(mode: 'mount' | 'render') {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const story = {
    id: 'story',
    variants: [],
    file: { component: defineComponent({ render: () => h('span', { 'data-story': '' }) }) },
  } as any
  const host = createPreviewHost({
    name: 'TestHost',
    el,
    getStory: () => story,
    getVariant: () => null,
    renderContext: { mode, slotName: 'default', currentVariant: null, externalState: null, nextVariantIndex: { value: 0 } } as any,
  })
  hosts.push(host)
  await host.mount()
  return el
}

describe('vue preview host wrappers', () => {
  it('wraps rendered stories', async () => {
    const el = await mountHost('render')
    expect(el.querySelectorAll('[data-wrapper]')).toHaveLength(1)
    expect(el.querySelector('[data-wrapper] [data-story]')).not.toBeNull()
  })

  it('runs the hidden story mount without wrappers', async () => {
    // A second live wrapper in the same window would duplicate shared
    // window-level UI (overlays, toasters) next to the rendered variant.
    const el = await mountHost('mount')
    expect(el.querySelector('[data-story]')).not.toBeNull()
    expect(el.querySelector('[data-wrapper]')).toBeNull()
  })
})
