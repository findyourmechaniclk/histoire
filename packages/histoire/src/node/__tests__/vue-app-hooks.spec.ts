import { describe, expect, it, vi } from 'vitest'
import { createAppHooks, getAppHooks } from '../../../../histoire-plugin-vue/src/client/app/app-hooks.js'

describe('vue app hooks', () => {
  it('runs registered stage callbacks in registration order per stage', async () => {
    const hooks = createAppHooks({})
    const calls: string[] = []
    hooks.api.onReady(() => {
      calls.push('ready')
    })
    hooks.api.onBeforeMount(async () => {
      calls.push('beforeMount:1')
    })
    hooks.api.onBeforeMount(() => {
      calls.push('beforeMount:2')
    })
    hooks.api.onMounted(() => {
      calls.push('mounted')
    })
    await hooks.run('beforeMount')
    await hooks.run('mounted')
    await hooks.run('ready')
    expect(calls).toEqual(['beforeMount:1', 'beforeMount:2', 'mounted', 'ready'])
  })

  it('cleans up once in reverse order, even after a setup failure before mount', () => {
    const hooks = createAppHooks({})
    const calls: string[] = []
    hooks.api.onCleanup(() => calls.push('first'))
    hooks.api.onCleanup(() => calls.push('second'))
    hooks.cleanup()
    hooks.cleanup()
    expect(calls).toEqual(['second', 'first'])
  })

  it('keeps cleaning up when one callback throws and rethrows the first error', () => {
    const hooks = createAppHooks({})
    const other = vi.fn()
    hooks.api.onCleanup(other)
    hooks.api.onCleanup(() => {
      throw new Error('cleanup failed')
    })
    expect(() => hooks.cleanup()).toThrow('cleanup failed')
    expect(other).toHaveBeenCalledTimes(1)
  })

  it('retires stage callbacks and queues late cleanups until the app is closed', async () => {
    const hooks = createAppHooks({})
    const mounted = vi.fn()
    hooks.api.onMounted(mounted)
    hooks.cleanup()
    await hooks.run('mounted')
    expect(mounted).not.toHaveBeenCalled()
    // Setup still running after retirement registers resources late; closing
    // (once setup settled) must release them after they were acquired.
    const late = vi.fn()
    hooks.api.onCleanup(late)
    expect(late).not.toHaveBeenCalled()
    hooks.close()
    expect(late).toHaveBeenCalledTimes(1)
    // Nothing drains a closed app anymore: release right away.
    const afterClose = vi.fn()
    hooks.api.onCleanup(afterClose)
    expect(afterClose).toHaveBeenCalledTimes(1)
    hooks.close()
    expect(late).toHaveBeenCalledTimes(1)
  })

  it('wraps setup calls with the registered context runner', async () => {
    const hooks = createAppHooks({})
    expect(await hooks.runWithContext(() => 'plain')).toBe('plain')
    const contexts: string[] = []
    hooks.api.setRunWithContext(async (callback) => {
      contexts.push('enter')
      try {
        return await callback()
      }
      finally {
        contexts.push('exit')
      }
    })
    const result = await hooks.runWithContext(() => {
      contexts.push('setupApp')
      return 'scoped'
    })
    expect(result).toBe('scoped')
    expect(contexts).toEqual(['enter', 'setupApp', 'exit'])
  })

  it('composes context runners from several integrations', async () => {
    const hooks = createAppHooks({})
    const contexts: string[] = []
    hooks.api.setRunWithContext((callback) => {
      contexts.push('first')
      return callback()
    })
    hooks.api.setRunWithContext((callback) => {
      contexts.push('second')
      return callback()
    })
    await hooks.runWithContext(() => contexts.push('setup'))
    // Newest innermost: a synchronous runner stays active even when an older
    // runner defers the callback.
    expect(contexts).toEqual(['first', 'second', 'setup'])
  })

  it('scopes hooks to their own app', async () => {
    const owner = {}
    const replacement = {}
    const ownerHooks = createAppHooks(owner)
    const replacementHooks = createAppHooks(replacement)
    const ownerReady = vi.fn()
    ownerHooks.api.onReady(ownerReady)
    await replacementHooks.run('ready')
    expect(ownerReady).not.toHaveBeenCalled()
    expect(getAppHooks(owner)).toBe(ownerHooks)
    expect(getAppHooks(replacement)).toBe(replacementHooks)
  })
})
