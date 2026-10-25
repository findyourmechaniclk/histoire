import type { Vue3AppHooksApi } from '@histoire/plugin-vue'
import type { PublicRuntimeConfig } from '@nuxt/schema'
import type { App } from 'h3'
import type { Component } from 'vue'
import type { ColorModeOptions } from './color-mode.js'
import { createApp } from 'h3'
import { createColorModeSync } from './color-mode.js'
import { createNuxtFetch } from './fetch.js'
import { createNuxtSetupContext } from './nuxt-context.js'
import { assertStoryAppHooks, initializeNuxtPreviewLifecycle } from './nuxt-lifecycle.js'
import { releaseRouterLink, selectStoryPlugins } from './plugins.js'
import { createUiAppWrapper } from './ui-app.js'

/** A real Histoire Vue app gets its own Nuxt payload and plugin lifecycle. */
interface NuxtPreviewSetup {
  /** Actual variant Vue app, never Nuxt's cached document entry app. */
  app: any
  /** Story app lifecycle hooks from `@histoire/plugin-vue`. */
  hooks: Vue3AppHooksApi
  /** Wraps the story, from `@histoire/plugin-vue`. */
  addWrapper?: (wrapper: Component, options?: { controls?: boolean }) => void
  /** Histoire dark mode subscription, from `@histoire/plugin-vue`. */
  onDarkChange?: (listener: (dark: boolean) => void) => void
}

/** Nuxt modules the story apps integrate with, detected by `HstNuxt`. */
export interface NuxtIntegrations {
  /** `@nuxtjs/color-mode` options (`#build/color-mode-options.mjs`). */
  colorMode?: ColorModeOptions
  /** Nuxt UI `App` component. */
  uiApp?: Component
}

const initializedApps = new WeakMap<object, Promise<void>>()
let nextApp = 0
let setupContext: ReturnType<typeof createNuxtSetupContext> | undefined

/** Set up Nuxt on actual story app; existing callers without app retain entry compatibility. */
export async function setupNuxtApp(publicConfig: PublicRuntimeConfig, setupApi?: NuxtPreviewSetup, appConfig: { baseURL?: string, buildAssetsDir?: string, cdnURL?: string } = { baseURL: '/' }, integrations: NuxtIntegrations = {}) {
  if (setupApi?.app) assertStoryAppHooks(setupApi)
  if (setupApi?.app && initializedApps.has(setupApi.app)) return initializedApps.get(setupApi.app)
  const pending = initialize()
  if (setupApi?.app) initializedApps.set(setupApi.app, pending)
  await pending

  /** Bootstrap data contains config only; each createNuxtApp allocates fresh state. */
  async function initialize() {
    const win = window as unknown as Window & { __app: App, __registry: Set<string>, __NUXT__: any, $fetch: any, Headers: typeof Headers }
    win.__NUXT__ = { serverRendered: false, config: { public: { ...publicConfig }, app: { baseURL: '/', ...appConfig } }, data: {}, state: {} }
    const h3App = createApp()
    const registry = new Set<string>()
    if (__HST_COLLECT__) {
      const { toNodeListener } = await import('h3')
      const { createCall, createFetch: createLocalFetch } = await import('unenv/runtime/fetch/index')
      // h3's Node adapter differs only in TypeScript server shape here.
      // @ts-expect-error Existing h3/unenv adapter compatibility.
      const localCall = createCall(toNodeListener(h3App))
      const localFetch = createLocalFetch(localCall, globalThis.fetch)
      win.fetch = (init: string, options?: any) => localFetch(typeof init === 'string' && registry.has(init) ? `/_${init}` : init, options)
    }
    win.$fetch = createNuxtFetch(win)
    win.__registry = registry
    win.__app = h3App
    if (!setupApi?.app) {
      const app = win.document.createElement('div')
      app.id = 'nuxt-test'
      win.document.body.appendChild(app)
      // @ts-expect-error Nuxt resolves virtual app entry in consumer project.
      const entry = await import('#app/entry')
      await entry.default()
      return
    }
    // The color-mode plugin reads its helper when its module loads, so install
    // it before importing the plugins.
    const syncColorMode = integrations.colorMode && createColorModeSync(win, integrations.colorMode)
    let colorModeState: (() => any) | undefined
    if (syncColorMode) setupApi.onDarkChange?.(dark => syncColorMode(dark, colorModeState?.()))
    if (integrations.uiApp) setupApi.addWrapper?.(createUiAppWrapper(integrations.uiApp), { controls: false })
    // These are Nuxt's own plugin/app services; reuse them rather than mounting
    // its memoized #app/entry root, which shares useState across grid cells.
    // @ts-expect-error Nuxt consumer aliases resolve portable setup at runtime.
    const { createNuxtApp, applyPlugins, getNuxtAppCtx } = await import('#app/nuxt')
    // @ts-expect-error Generated consumer plugin inventory.
    const { default: plugins } = await import('#build/plugins')
    // @ts-expect-error Generated Nuxt application mode.
    const { multiApp } = await import('#build/nuxt.config.mjs')
    const id = `histoire-preview-${++nextApp}`
    // Other app plugins may delete bootstrap while imports await. Supply fresh
    // config immediately before synchronous construction under Nuxt's own mode.
    const payload = { serverRendered: false, config: { public: { ...publicConfig }, app: { baseURL: '/', ...appConfig } }, data: {}, state: {} }
    win.__NUXT__ = multiApp ? { ...win.__NUXT__, [id]: payload } : payload
    const nuxt = createNuxtApp({ vueApp: setupApi.app, id })
    nuxt.isHydrating = false
    colorModeState = () => nuxt.$colorMode
    const originalRun = nuxt.runWithContext.bind(nuxt)
    const fallback = getNuxtAppCtx()
    setupContext ??= createNuxtSetupContext(fallback)
    nuxt.runWithContext = (callback: () => unknown) => setupContext.call(nuxt, () => originalRun(callback))
    setupApi.hooks.setRunWithContext(callback => setupContext.setup(nuxt, () => originalRun(callback)))
    await initializeNuxtPreviewLifecycle(setupApi.hooks, nuxt._scope, () => {
      getNuxtAppCtx(nuxt._id).unset()
      if (fallback.tryUse() === nuxt) fallback.unset()
      delete win.__NUXT__?.[id]
    }, () => setupContext.setup(nuxt, async () => {
      releaseRouterLink(setupApi.app)
      await applyPlugins(nuxt, selectStoryPlugins(plugins, __HST_COLLECT__))
      await nuxt.callHook('app:created', setupApi.app)
    }), stage => setupContext.setup(nuxt, () => originalRun(() => nuxt.callHook(stage, setupApi.app))))
  }
}
