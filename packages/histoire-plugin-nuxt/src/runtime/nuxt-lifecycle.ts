import type { Vue3AppHooksApi } from '@histoire/plugin-vue'

/** Subset of the story app hooks used by the Nuxt runtime. */
export type NuxtLifecycleHooks = Pick<Vue3AppHooksApi, 'onBeforeMount' | 'onMounted' | 'onReady' | 'onCleanup'>

/**
 * Fail clearly when an older `@histoire/plugin-vue` doesn't provide the story
 * app hooks this runtime relies on (peer dependency mismatches only warn).
 */
export function assertStoryAppHooks<T extends { hooks?: unknown }>(setupApi: T): asserts setupApi is T & { hooks: Vue3AppHooksApi } {
  if (!setupApi.hooks) {
    throw new Error('@histoire/plugin-nuxt needs story app hooks from @histoire/plugin-vue. Update @histoire/plugin-vue to the same version as @histoire/plugin-nuxt.')
  }
}

/** Nuxt hooks that normally belong to its document entry/root. */
type NuxtMountStage = 'app:beforeMount' | 'app:mounted' | 'app:suspense:resolve'

/** Run Nuxt plugin setup, then tie its scope/context release to the story app lifecycle. */
export async function initializeNuxtPreviewLifecycle(hooks: NuxtLifecycleHooks, scope: { stop: () => void }, clearContext: () => void, setup: () => Promise<void>, lifecycle?: (stage: NuxtMountStage) => Promise<void>): Promise<void> {
  let closed = false
  /** Both plugin failure and actual app retirement share one resource release. */
  const cleanup = () => {
    if (closed) return
    closed = true
    try {
      scope.stop()
    }
    finally {
      clearContext()
    }
  }
  /** Forward one host mount stage to Nuxt, releasing resources if it fails. */
  const stage = (name: NuxtMountStage) => async () => {
    if (closed) return
    try {
      await lifecycle?.(name)
    }
    catch (error) {
      cleanup()
      throw error
    }
  }
  hooks.onBeforeMount(stage('app:beforeMount'))
  hooks.onMounted(stage('app:mounted'))
  hooks.onReady(stage('app:suspense:resolve'))
  try {
    await setup()
  }
  catch (error) {
    cleanup()
    throw error
  }
  // Registered once plugins ran: if the story app retired meanwhile, the host
  // releases it after setup settles, so the scope stops every plugin effect
  // instead of letting later plugins run unscoped on a stopped scope.
  hooks.onCleanup(cleanup)
}
