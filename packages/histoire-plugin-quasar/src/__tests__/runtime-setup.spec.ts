import { describe, expect, it, vi } from 'vitest'
import { setupQuasarApp } from '../runtime/setup.js'

/** Story setup API double recording installed plugins and dark listeners. */
function createSetupApi() {
  const installed: unknown[] = []
  const darkListeners: Array<(dark: boolean) => void> = []
  return {
    installed,
    darkListeners,
    api: {
      app: { use: (plugin: unknown) => installed.push(plugin) } as any,
      onDarkChange: (listener: (dark: boolean) => void) => darkListeners.push(listener),
    },
  }
}

/** Pinia-like store double supporting plugins. */
function createStore() {
  const plugins: Array<(context: { store: any }) => void> = []
  return { plugins, use: (plugin: (context: { store: any }) => void) => plugins.push(plugin) }
}

const Quasar = { name: 'Quasar' }

describe('setupQuasarApp', () => {
  it('installs Quasar and the store, then runs boot files with Quasar CLI params', async () => {
    const { api, installed } = createSetupApi()
    const store = createStore()
    const router = { name: 'router' }
    const boot = vi.fn()
    await setupQuasarApp(api, {
      Quasar,
      Dark: { set: vi.fn() },
      options: { plugins: {} },
      createStore: vi.fn(async () => store),
      createRouter: () => router,
      bootFiles: [{ path: '@/boot/a', load: async () => ({ default: boot }) }],
    })
    expect(installed).toEqual([Quasar, store])
    expect(boot).toHaveBeenCalledWith(expect.objectContaining({ app: api.app, router, store, ssrContext: null, urlPath: '/' }))
    // Quasar CLI exposes the router to Pinia stores as `this.router`.
    const storeInstance: any = {}
    store.plugins.forEach(plugin => plugin({ store: storeInstance }))
    expect(storeInstance.router).toBe(router)
  })

  it('names the boot file when importing or running it fails', async () => {
    const { api } = createSetupApi()
    const options = { Quasar, Dark: { set: vi.fn() }, options: {} }
    await expect(setupQuasarApp(api, { ...options, bootFiles: [{ path: '@/boot/broken', load: async () => {
      throw new Error('syntax error')
    } }] })).rejects.toThrow('Quasar boot file "@/boot/broken" failed: syntax error')
    await expect(setupQuasarApp(api, { ...options, bootFiles: [{ path: '@/boot/run', load: async () => ({ default: () => {
      throw new Error('boom')
    } }) }] })).rejects.toThrow('Quasar boot file "@/boot/run" failed: boom')
  })

  it('stops running boot files after one redirects and syncs Dark with Histoire', async () => {
    const { api, darkListeners } = createSetupApi()
    const Dark = { set: vi.fn() }
    const next = vi.fn()
    await setupQuasarApp(api, {
      Quasar,
      Dark,
      options: {},
      bootFiles: [
        { path: '@/boot/auth', load: async () => ({ default: ({ redirect }) => redirect('/login') }) },
        { path: '@/boot/next', load: async () => ({ default: next }) },
      ],
    })
    expect(next).not.toHaveBeenCalled()
    darkListeners.forEach(listener => listener(true))
    expect(Dark.set).toHaveBeenCalledWith(true)
  })

  it('explains an outdated @histoire/plugin-vue without onDarkChange', async () => {
    const api = { app: { use: vi.fn() } } as any
    await expect(setupQuasarApp(api, { Quasar, Dark: { set: vi.fn() }, options: {}, bootFiles: [] }))
      .rejects
      .toThrow('Update @histoire/plugin-vue')
    expect(api.app.use).not.toHaveBeenCalled()
  })
})
