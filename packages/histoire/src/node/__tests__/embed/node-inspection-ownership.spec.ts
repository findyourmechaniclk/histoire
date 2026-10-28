import { describe, expect, it } from 'vitest'
import { awaitInspectionExecution } from '../../api/inspection-execution.js'
import { createExecutionService } from '../../runtime/execution-service.js'

describe('isolated inspection ownership', () => {
  it('uses a real AbortSignal even when instance listener methods are shadowed', async () => {
    const execution = createExecutionService()
    const release = Promise.withResolvers<void>()
    const blocker = execution.enqueue({ run: () => release.promise })
    const controller = new AbortController()
    Object.defineProperties(controller.signal, {
      addEventListener: { value: () => { throw new Error('shadowed add') } },
      removeEventListener: { value: () => { throw new Error('shadowed remove') } },
    })
    try {
      await Promise.resolve()
      const handle = execution.enqueue({ run: () => 'must not start' })
      const result = expect(awaitInspectionExecution(handle, () => true, controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' })
      controller.abort()
      await result
      expect(execution.pendingCount).toBe(0)
    }
    finally {
      release.resolve()
      await blocker.result
      await execution.close()
    }
  })

  it.each(['success', 'failure'] as const)('rejects stale %s after owned cleanup completes', async (outcome) => {
    const execution = createExecutionService()
    const cleaning = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    let active = true
    const handle = execution.enqueue({
      run() {
        if (outcome === 'failure') throw new Error('old source failed')
        return 'old result'
      },
      async cleanup() {
        cleaning.resolve()
        await release.promise
      },
    })
    const result = awaitInspectionExecution(handle, () => active)
    const stale = expect(result).rejects.toMatchObject({ code: 'RUNTIME_CHANGED' })
    try {
      await cleaning.promise
      active = false
      release.resolve()
      await stale
      await expect(execution.enqueue({ run: () => 'new source' }).result).resolves.toBe('new source')
    }
    finally {
      release.resolve()
      await execution.close()
    }
  })

  it('preserves cancellation and unconfirmed cleanup when ownership also changes', async () => {
    const execution = createExecutionService()
    const cleaning = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const controller = new AbortController()
    let active = true
    const handle = execution.enqueue({ run: () => 'result', async cleanup() {
      cleaning.resolve()
      await release.promise
    } })
    const cancelled = awaitInspectionExecution(handle, () => active, controller.signal)
    try {
      await cleaning.promise
      active = false
      controller.abort()
      release.resolve()
      await expect(cancelled).rejects.toMatchObject({ code: 'CANCELLED' })
    }
    finally {
      release.resolve()
      await execution.close()
    }

    const unsafe = createExecutionService()
    try {
      const failed = unsafe.enqueue({ run: () => 'result', cleanup() {
        throw new Error('cleanup failed')
      } })
      await expect(awaitInspectionExecution(failed, () => false)).rejects.toMatchObject({ code: 'CLEANUP_UNCONFIRMED' })
      expect(unsafe.available).toBe(false)
    }
    finally { await unsafe.close().catch(() => {}) }
  })
})
