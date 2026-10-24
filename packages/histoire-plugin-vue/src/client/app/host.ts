import type { Story, Variant } from '@histoire/shared'
import type { App, Component, VNode } from 'vue'
import type { Vue3StorySetupApi } from '../../helpers.js'
import type { PreviewRenderContext } from './render-context.js'
import { onHistoireDarkChange, registerHistoireGlobalsAdapter, registerStoryExecutionTargetResolver, useHistoireGlobals, withStoryExecution } from '@histoire/shared'
import {
  createApp,
  getCurrentInstance,
  h,
  nextTick,
  reactive,
  Suspense,
} from 'vue'
import { createAppHooks, getAppHooks } from './app-hooks.js'
import { registerGlobalComponents } from './global-components.js'
import { PreviewHostRoot } from './host-root.js'
import { mountStoryPass, type StoryMountPass } from './mount-pass.js'
import { RouterLinkStub } from './RouterLinkStub'
import { runSetupHooks } from './setup-hooks.js'

// Reads story app's Vue instance, never Histoire's separate vendor Vue instance.
registerStoryExecutionTargetResolver('vue', () => (getCurrentInstance()?.appContext.app as any)?.__HST_STORY_MOUNT_TARGET__)

const runtimeGlobals = reactive({})
registerHistoireGlobalsAdapter(() => runtimeGlobals, (value) => {
  for (const key of Object.keys(runtimeGlobals)) {
    if (!Object.hasOwn(value, key)) delete runtimeGlobals[key]
  }
  Object.assign(runtimeGlobals, value)
})

interface PreviewHostOptions {
  name: string
  el: HTMLElement
  getStory: () => Story
  getVariant: () => Variant | null
  renderContext: PreviewRenderContext
  wrapInDiv?: boolean
  /**
   * Render host only: when the variant isn't configured yet (no hidden mount
   * app in this document), run the story mount pass inside this app first.
   */
  configureStory?: boolean
}

/** Own isolated story app and publish readiness after first root Suspense resolves. */
export function createPreviewHost(options: PreviewHostOptions) {
  let app: App = null
  let target: HTMLDivElement = null
  let retireMount: (() => void) | undefined
  let storyPass: StoryMountPass | undefined

  /**
   * Waits for the user Vue app to flush render-time mutations like auto-prop
   * detection before the bundled wrapper reports readiness.
   */
  async function waitForHostRenderSettled() {
    await nextTick()
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }

  async function mount() {
    const wrappers: Array<{ component: Component, controls: boolean }> = []
    let resolveRoot: () => void
    let rejectRoot: (error: Error) => void
    // Suspense can resolve synchronously inside app.mount; install waiter first.
    const rootReady = new Promise<void>((resolve, reject) => {
      resolveRoot = resolve
      rejectRoot = reject
    })
    void rootReady.catch(() => {})
    /** Observe retirement even before asynchronous root setup finishes. */
    const retire = () => rejectRoot(new Error('Preview host retired during mounting'))
    retireMount = retire

    target = document.createElement('div')
    options.el.appendChild(target)

    app = createApp({
      name: options.name,

      render: () => {
        let vnode: VNode = h(PreviewHostRoot, {
          story: options.getStory(),
          renderContext: options.renderContext,
        })

        const controlsSlot = options.renderContext.slotName === 'controls'
        // The hidden mount only registers story metadata, like collection,
        // which runs without wrappers too. Wrappers there would be a second
        // live copy of app providers in this window, duplicating shared UI
        // such as overlays and toasts (e.g. Nuxt UI `UApp` + `useOverlay()`).
        const hiddenMount = options.renderContext.mode === 'mount'
        for (const wrapper of hiddenMount ? [] : wrappers) {
          if (controlsSlot && !wrapper.controls) continue
          const child = vnode
          vnode = h(wrapper.component, {
            story: options.getStory(),
            variant: options.getVariant(),
          }, () => child)
        }

        if (options.wrapInDiv) {
          vnode = h('div', vnode)
        }

        return h(Suspense, { onResolve: resolveRoot }, vnode)
      },
    })
    const ownerApp = app
    const ownerTarget = target
    ;(ownerApp as any).__HST_STORY_MOUNT_TARGET__ = ownerTarget
    /** Late setup/mount hooks cannot mount or publish a replacement owner. */
    function assertOwner() {
      if (app !== ownerApp || target !== ownerTarget) throw new Error('Preview host retired during mounting')
    }

    const hooks = createAppHooks(ownerApp)

    registerGlobalComponents(app)
    app.component('RouterLink', RouterLinkStub)

    const setupApi: Vue3StorySetupApi = {
      app,
      globals: useHistoireGlobals(),
      story: options.getStory(),
      variant: options.getVariant(),
      addWrapper: (wrapper, wrapperOptions) => {
        wrappers.unshift({ component: wrapper, controls: wrapperOptions?.controls ?? true })
      },
      hooks: hooks.api,
      onDarkChange: listener => hooks.api.onCleanup(onHistoireDarkChange(listener)),
    }

    try {
      await runSetupHooks(setupApi, hooks, options.configureStory && !options.getVariant()?.configReady
        ? async () => {
          storyPass = mountStoryPass(ownerApp, options.getStory(), options.el)
          await storyPass.ready
          assertOwner()
        }
        : undefined)
      assertOwner()
      await hooks.run('beforeMount')
      assertOwner()

      // Registration remains attributed to this exact app during synchronous
      // mount; readiness waits actual async setup and framework stage hooks.
      withStoryExecution(() => ownerApp.mount(ownerTarget), ownerTarget)
      await rootReady
      assertOwner()
      await hooks.run('mounted')
      assertOwner()
      await hooks.run('ready')
      assertOwner()
      await waitForHostRenderSettled()
      assertOwner()
      if (retireMount === retire) retireMount = undefined
    }
    catch (error) {
      // Framework/plugin setup may allocate effects before app ever mounts.
      if (app === ownerApp) unmount()
      // Setup has settled: imports that finished after an earlier unmount may
      // have registered resources on the retired app. Release the captured
      // owner for good, never the replacement app.
      cleanupApp(ownerApp, true)
      throw error
    }
  }

  /**
   * Release one app's hooks and unmount it. `final` once its setup can no
   * longer register resources. Cleanup errors are logged: they must neither
   * block the next mount nor hide a setup/mount failure.
   */
  function cleanupApp(owner: App, final: boolean) {
    if (!owner) return
    const hooks = getAppHooks(owner)
    try {
      if (final) hooks?.close()
      else hooks?.cleanup()
    }
    catch (cleanupError) {
      console.error(cleanupError)
    }
    finally {
      // Vue keeps `_container` after unmount; it only clears this marker.
      // A second `unmount()` would run plugin `onUnmount` cleanups again.
      if ((owner._container as any)?.__vue_app__ === owner) owner.unmount()
    }
  }

  /** Retire the current app and remove its element. */
  function unmount() {
    // A pending mount still runs setup; its failure path closes the app.
    const mountPending = retireMount !== undefined
    retireMount?.()
    retireMount = undefined
    storyPass?.unmount()
    storyPass = undefined
    cleanupApp(app, !mountPending)
    app = null

    if (target) {
      target.parentNode?.removeChild(target)
      target = null
    }
  }

  function forceUpdate() {
    app?._instance?.proxy?.$forceUpdate()
  }

  return {
    mount,
    unmount,
    forceUpdate,
  }
}
