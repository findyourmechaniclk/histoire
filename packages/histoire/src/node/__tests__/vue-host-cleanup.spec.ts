// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

/** User setup file double, replaced per test. */
const userSetup = vi.hoisted(() => ({ setupVue3: undefined as undefined | ((api: any) => unknown) }))

vi.mock('virtual:$histoire-setup', () => userSetup)

const { createPreviewHost } = await import('../../../../histoire-plugin-vue/src/client/app/host.js')

/** Host rendering a trivial story into a fresh element. */
function createHost(variant: any = null) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const story = { id: 'story', file: { component: defineComponent({ render: () => h('p', 'story') }) } }
  const host = createPreviewHost({
    name: 'test',
    el,
    getStory: () => story as any,
    getVariant: () => variant,
    renderContext: { slotName: 'default' } as any,
  })
  return { el, host }
}

describe('vue story host cleanup', () => {
  afterEach(() => {
    userSetup.setupVue3 = undefined
    document.body.innerHTML = ''
  })

  it('releases resources registered by setup still running when the story was closed', async () => {
    let finishSetup!: () => void
    const released = vi.fn()
    userSetup.setupVue3 = async ({ hooks }) => {
      await new Promise<void>((resolve) => {
        finishSetup = resolve
      })
      hooks.onCleanup(released)
    }
    const { host, el } = createHost()
    const mounting = host.mount()
    await vi.waitFor(() => expect(finishSetup).toBeTypeOf('function'))
    host.unmount()
    expect(el.childElementCount).toBe(0)
    finishSetup()
    await expect(mounting).rejects.toThrow('retired')
    expect(released).toHaveBeenCalledTimes(1)
  })

  it('keeps working after a cleanup callback throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    userSetup.setupVue3 = ({ hooks }) => {
      hooks.onCleanup(() => {
        throw new Error('cleanup failed')
      })
    }
    const { host, el } = createHost()
    await host.mount()
    expect(el.textContent).toBe('story')
    expect(() => host.unmount()).not.toThrow()
    expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ message: 'cleanup failed' }))
    expect(el.childElementCount).toBe(0)
    await host.mount()
    expect(el.textContent).toBe('story')
    consoleError.mockRestore()
  })

  it('stops running setup functions once the story was closed', async () => {
    let finishSetup!: () => void
    userSetup.setupVue3 = () => new Promise<void>((resolve) => {
      finishSetup = resolve
    })
    const setupApp = vi.fn()
    const { host } = createHost({ setupApp })
    const mounting = host.mount()
    await vi.waitFor(() => expect(finishSetup).toBeTypeOf('function'))
    host.unmount()
    finishSetup()
    await expect(mounting).rejects.toThrow('retired')
    expect(setupApp).not.toHaveBeenCalled()
  })

  it('unmounts the Vue app once when a mount stage fails', async () => {
    const pluginCleanup = vi.fn()
    userSetup.setupVue3 = ({ app, hooks }) => {
      // e.g. Vuetify releases its resources this way.
      app.onUnmount(pluginCleanup)
      hooks.onMounted(() => {
        throw new Error('mounted hook failed')
      })
    }
    const { host } = createHost()
    await expect(host.mount()).rejects.toThrow('mounted hook failed')
    expect(pluginCleanup).toHaveBeenCalledTimes(1)
  })
})
