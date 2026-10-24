import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref, watch } from 'vue'
import { assertStoryAppHooks, initializeNuxtPreviewLifecycle } from '../../../../../histoire-plugin-nuxt/src/runtime/nuxt-lifecycle.js'
import { createAppHooks } from '../../../../../histoire-plugin-vue/src/client/app/app-hooks.js'

describe('nuxt preview lifecycle', () => {
  it('stops effects when plugin startup fails before Vue mount', async () => {
    const scope = effectScope()
    const value = ref(0)
    const observed = vi.fn()
    const clearContext = vi.fn()
    const hooks = createAppHooks({})
    await expect(initializeNuxtPreviewLifecycle(hooks.api, scope, clearContext, async () => {
      scope.run(() => watch(value, observed, { flush: 'sync' }))
      value.value++
      throw new Error('plugin failed')
    })).rejects.toThrow('plugin failed')
    value.value++
    expect(observed).toHaveBeenCalledTimes(1)
    expect(clearContext).toHaveBeenCalledTimes(1)
    hooks.close()
    expect(clearContext).toHaveBeenCalledTimes(1)
  })

  it('forwards host mount stages and retires them when app closes', async () => {
    const hooks = createAppHooks({})
    const hook = vi.fn(async (_stage: string) => {})
    const stop = vi.fn()
    await initializeNuxtPreviewLifecycle(hooks.api, { stop }, () => {}, async () => {}, hook)
    await hooks.run('beforeMount')
    await hooks.run('mounted')
    await hooks.run('ready')
    expect(hook.mock.calls.map(([stage]) => stage)).toEqual(['app:beforeMount', 'app:mounted', 'app:suspense:resolve'])
    hooks.cleanup()
    await hooks.run('mounted')
    expect(hook).toHaveBeenCalledTimes(3)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('releases owned Nuxt resources if awaited mount hook fails', async () => {
    const hooks = createAppHooks({})
    const stop = vi.fn()
    const clear = vi.fn()
    await initializeNuxtPreviewLifecycle(hooks.api, { stop }, clear, async () => {}, async () => {
      throw new Error('mount failed')
    })
    await expect(hooks.run('mounted')).rejects.toThrow('mount failed')
    expect(stop).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledTimes(1)
    hooks.cleanup()
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['before Nuxt setup', 'before'],
    ['during Nuxt plugins', 'during'],
  ])('releases Nuxt plugin effects when the story app retired %s', async (_label, when) => {
    const hooks = createAppHooks({})
    const scope = effectScope()
    const value = ref(0)
    const observed = vi.fn()
    if (when === 'before') hooks.cleanup()
    await initializeNuxtPreviewLifecycle(hooks.api, scope, () => {}, async () => {
      if (when === 'during') hooks.cleanup()
      // Like Nuxt's runWithContext: a stopped scope runs plugins unscoped.
      const plugin = () => watch(value, observed, { flush: 'sync' })
      if (scope.active) scope.run(plugin)
      else plugin()
    })
    // Host's retired-owner close runs after setup settled.
    hooks.close()
    value.value++
    expect(observed).not.toHaveBeenCalled()
  })

  it('explains an outdated @histoire/plugin-vue without story app hooks', () => {
    expect(() => assertStoryAppHooks({ app: {} })).toThrow('Update @histoire/plugin-vue')
    expect(() => assertStoryAppHooks({ app: {}, hooks: createAppHooks({}).api })).not.toThrow()
  })
})
