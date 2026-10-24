import type { Vue3AppContextRunner, Vue3AppHookCallback, Vue3AppHooksApi } from '../../helpers.js'

/** Mount stages a story app goes through, in order. */
export type Vue3AppStage = 'beforeMount' | 'mounted' | 'ready'

/** Host-side controller of one story app's lifecycle hooks. */
export interface Vue3AppHooks {
  /** Registration API handed to setup functions. */
  api: Vue3AppHooksApi
  /** Run callbacks of one stage sequentially. No-op once retired. */
  run: (stage: Vue3AppStage) => Promise<void>
  /**
   * Retire the app and run pending cleanup callbacks once each, newest first.
   * Setup may still be running: later registrations wait for the next call.
   */
  cleanup: () => void
  /**
   * Final cleanup once no setup can still run: later registrations are
   * released immediately since nothing would drain them anymore.
   */
  close: () => void
  /** Whether the app was retired; remaining setup functions are then skipped. */
  readonly retired: boolean
  /** Call a setup function inside the registered framework context, if any. */
  runWithContext: Vue3AppContextRunner
}

const hooksByApp = new WeakMap<object, Vue3AppHooks>()

/** Hooks previously created for an app, if any. */
export function getAppHooks(app: object): Vue3AppHooks | undefined {
  return hooksByApp.get(app)
}

/** Create the lifecycle hooks owned by exactly one story app. */
export function createAppHooks(app: object): Vue3AppHooks {
  const stages: Record<Vue3AppStage, Vue3AppHookCallback[]> = {
    beforeMount: [],
    mounted: [],
    ready: [],
  }
  const cleanups: Array<() => void> = []
  let retired = false
  let closed = false
  let contextRunner: Vue3AppContextRunner | undefined

  const hooks: Vue3AppHooks = {
    api: {
      onBeforeMount: callback => stages.beforeMount.push(callback),
      onMounted: callback => stages.mounted.push(callback),
      onReady: callback => stages.ready.push(callback),
      onCleanup: (callback) => {
        if (closed) callback()
        // After retirement, wait for close: integrations then release resources
        // acquired after this registration too.
        else cleanups.push(callback)
      },
      setRunWithContext: (runner) => {
        // Compose runners, newest innermost: a synchronous runner stays active
        // even when an older one defers the callback.
        const previous = contextRunner
        contextRunner = previous ? callback => previous(() => runner(callback)) : runner
      },
    },

    get retired() {
      return retired
    },

    async run(stage) {
      for (const callback of stages[stage]) {
        if (retired) return
        await callback()
      }
    },

    cleanup() {
      retired = true
      let firstError: unknown
      // Release in reverse acquisition order; one failure must not leak the rest.
      while (cleanups.length) {
        try {
          cleanups.pop()!()
        }
        catch (error) {
          firstError ??= error
        }
      }
      if (firstError) throw firstError
    },

    close() {
      closed = true
      hooks.cleanup()
    },

    runWithContext: callback => contextRunner ? contextRunner(callback) : callback(),
  }

  hooksByApp.set(app, hooks)
  return hooks
}
