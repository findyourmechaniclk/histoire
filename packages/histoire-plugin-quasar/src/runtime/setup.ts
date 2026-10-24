import type { Vue3StorySetupApi } from '@histoire/plugin-vue'
import type { App } from 'vue'

/** Parameters Quasar CLI passes to boot files (client side, SPA). */
export interface QuasarBootParams {
  /** Story Vue app. */
  app: App
  /** Router with memory history, never installed on the app. */
  router: unknown
  /** Project store, if any. */
  store: unknown
  /** Always `null`: stories render client side. */
  ssrContext: null
  /** Router-facing URL. */
  urlPath: string
  /** Public base path. */
  publicPath: string
  /** Stops running the remaining boot files; never navigates. */
  redirect: (url: unknown) => void
}

/** Lazily imported client boot file. */
export interface QuasarBootFile {
  /** Import path, for error messages. */
  path: string
  /** Dynamic import of the boot module. */
  load: () => Promise<{ default?: unknown }>
}

/** Values generated from `quasar.config` by the Histoire plugin. */
export interface QuasarAppSetupOptions {
  /** Quasar Vue plugin. */
  Quasar: any
  /** Quasar Dark plugin, synced with Histoire's dark mode. */
  Dark: { set: (value: boolean | 'auto') => void }
  /** Options for `app.use(Quasar, options)`. */
  options: Record<string, unknown>
  /** Store factory or instance from `src/stores/index`. */
  createStore?: unknown
  /** Router factory for boot files; never installed on the story app. */
  createRouter?: () => unknown
  /** Client boot files, in order. */
  bootFiles: QuasarBootFile[]
}

/** Part of the `@histoire/plugin-vue` setup API used here. */
type SetupApi = Pick<Vue3StorySetupApi, 'app' | 'onDarkChange'>

/** Create the project store like Quasar CLI's app entry, exposing the router to Pinia stores. */
async function createProjectStore(app: App, createStore: unknown, router: unknown) {
  const store: any = typeof createStore === 'function'
    ? await createStore({ ssrContext: null })
    : createStore
  app.use(store)
  // Quasar CLI makes `this.router` available in Pinia stores.
  if (router && typeof store?.use === 'function') {
    store.use(({ store: instance }: { store: any }) => {
      instance.router = router
    })
  }
  return store
}

/** Run client boot files in order; a redirect stops the chain like in Quasar CLI. */
async function runBootFiles(bootFiles: QuasarBootFile[], params: Omit<QuasarBootParams, 'redirect'>) {
  let redirected = false
  const bootParams: QuasarBootParams = {
    ...params,
    // Stories never navigate away from the sandbox.
    redirect: () => {
      redirected = true
    },
  }
  for (const bootFile of bootFiles) {
    if (redirected) return
    try {
      const { default: boot } = await bootFile.load()
      if (typeof boot === 'function') await boot(bootParams)
    }
    catch (error) {
      throw new Error(`Quasar boot file "${bootFile.path}" failed: ${(error as Error)?.message ?? error}`, { cause: error })
    }
  }
}

/** Install Quasar, the project store and client boot files on one story app. */
export async function setupQuasarApp(setupApi: SetupApi, setup: QuasarAppSetupOptions) {
  // Peer dependency mismatches only warn; fail before touching the app.
  if (typeof setupApi.onDarkChange !== 'function') {
    throw new TypeError('@histoire/plugin-quasar needs onDarkChange from @histoire/plugin-vue. Update @histoire/plugin-vue to the same version as @histoire/plugin-quasar.')
  }
  const { app } = setupApi
  app.use(setup.Quasar, setup.options)

  const router = setup.createRouter?.()
  const store = setup.createStore ? await createProjectStore(app, setup.createStore, router) : undefined

  await runBootFiles(setup.bootFiles, {
    app,
    router,
    store,
    ssrContext: null,
    urlPath: '/',
    publicPath: (import.meta as any).env?.BASE_URL ?? '/',
  })

  setupApi.onDarkChange(dark => setup.Dark.set(dark))
}
