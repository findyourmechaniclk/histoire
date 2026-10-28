import { Console } from 'node:console'
import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { createDebugBuffer } from '../../../histoire-protocol/src/inspection/debug-buffer.js'
import { observeRuntimeDiagnostics } from '../../../histoire-shared/src/inspection/diagnostics.js'
import { createRuntimeDebug } from '../../../histoire/src/node/virtual/preview-runtime/debug-service.js'
import { SessionContext } from '../session/context.js'
import { createSessionDebug } from '../session/debug.js'

const owner = { sourceId: 'source', epoch: 'epoch', revision: 'revision', runtimeId: 'document', target: { storyId: 'story', variantId: 'variant' } }
const bridge = { ...owner, sessionId: 'session', connectionId: 'connection', mountId: 'mount' }

/** Exercise real SDK collector and document service with a local event target. */
function fixture() {
  const target = new EventTarget() as EventTarget & { console: Console }
  target.console = new Console(new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  }))
  const runtime = createRuntimeDebug(target as any, createDebugBuffer, observeRuntimeDiagnostics)
  const context = new SessionContext({ url: 'https://example.test/' }, {} as any)
  context.connection = {} as any
  context.publish({ status: 'ready' })
  return { target, runtime, context }
}

/** Bound eventual observation without replacing the scheduler. */
function waitForMessage(subscribe: (callback: (page: any) => void) => void, message: string) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Diagnostic message not received: ${message}`)), 2000)
    subscribe((page) => {
      if (page.items.some((item: { message: string }) => item.message === message)) {
        clearTimeout(timeout)
        resolve()
      }
    })
  })
}

describe('diagnostic observation lifetime', () => {
  it('shares one observation and keeps surviving subscribers active', async () => {
    const { target, runtime, context } = fixture()
    const original = target.console.log
    const debug = createSessionDebug(context, () => ({ owner, current: () => true, invoke: async (action, observationId, afterSequence) => runtime.run({ action, observationId, afterSequence, expectedOwner: owner }, bridge) }))
    let first: ReturnType<typeof debug.subscribe> | undefined
    let second: ReturnType<typeof debug.subscribe> | undefined
    try {
      first = debug.subscribe(() => {})
      const received = waitForMessage((callback) => {
        second = debug.subscribe(callback)
      }, 'survivor')
      await Promise.all([first.ready, second!.ready])
      await first.unsubscribe()
      target.console.log('survivor')
      await received
      expect(debug.getSnapshot().items.map(item => item.message)).toEqual(['survivor'])
      await second!.unsubscribe()
      expect(target.console.log).toBe(original)
    }
    finally {
      await first?.unsubscribe()
      await second?.unsubscribe()
      runtime.close()
    }
  })

  it('retires a held registration without allowing its late reply to close a successor', async () => {
    const { target, runtime, context } = fixture()
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    let firstId: string | undefined
    const debug = createSessionDebug(context, () => ({
      owner,
      current: () => true,
      async invoke(action, observationId, afterSequence) {
        const page = runtime.run({ action, observationId, afterSequence, expectedOwner: owner }, bridge)
        if (action === 'start' && !firstId) {
          firstId = observationId
          started.resolve()
          await release.promise
        }
        return page
      },
    }))
    let first: ReturnType<typeof debug.subscribe> | undefined
    let second: ReturnType<typeof debug.subscribe> | undefined
    try {
      first = debug.subscribe(() => {})
      const firstReady = first.ready.catch(error => error)
      await started.promise
      let cleanupSettled = false
      const cleanup = first.unsubscribe().finally(() => {
        cleanupSettled = true
      })
      const received = waitForMessage((callback) => {
        second = debug.subscribe(callback)
      }, 'fresh')
      await second!.ready
      expect(cleanupSettled).toBe(false)
      release.resolve()
      expect((await firstReady).code).toBe('CANCELLED')
      await cleanup
      target.console.log('fresh')
      await received
      expect(debug.getSnapshot().items.map(item => item.message)).toEqual(['fresh'])
    }
    finally {
      release.resolve()
      await first?.unsubscribe()
      await second?.unsubscribe()
      runtime.close()
    }
  })

  it('retains evidence on unsubscribe but removes it before observing revoked authority or disposal', async () => {
    const { target, runtime, context } = fixture()
    const debug = createSessionDebug(context, () => ({ owner, current: () => context.snapshot.status === 'ready', invoke: async (action, observationId, afterSequence) => runtime.run({ action, observationId, afterSequence, expectedOwner: owner }, bridge) }))
    let handle: ReturnType<typeof debug.subscribe> | undefined
    const seenDuringWithdrawal: string[][] = []
    context.listeners.add(() => seenDuringWithdrawal.push(debug.getSnapshot().items.map(item => item.message)))
    try {
      const received = waitForMessage((callback) => {
        handle = debug.subscribe(callback)
      }, 'private evidence')
      await handle!.ready
      target.console.log('private evidence')
      await received
      await handle!.unsubscribe()
      expect(debug.getSnapshot().items.map(item => item.message)).toEqual(['private evidence'])
      // This session observer runs before debug's own lifetime listener.
      context.publish({ status: 'failed' })
      expect(seenDuringWithdrawal).toEqual([[]])
      context.publish({ status: 'ready' })
      expect(debug.getSnapshot().items).toEqual([])
      const receivedAgain = waitForMessage((callback) => {
        handle = debug.subscribe(callback)
      }, 'new evidence')
      await handle!.ready
      target.console.log('new evidence')
      await receivedAgain
      const sequence = debug.getSnapshot().items[0].sequence
      expect(sequence).toBeGreaterThan(1)
      const retired = handle!.closed.catch(error => error)
      context.publish({ status: 'disposed' })
      expect(await retired).toMatchObject({ code: 'RUNTIME_CHANGED' })
      expect(debug.getSnapshot().items).toEqual([])
    }
    finally {
      await handle?.unsubscribe()
      runtime.close()
    }
  })

  it('notifies each subscriber when an active runtime observation is lost', async () => {
    const { runtime, context } = fixture()
    const debug = createSessionDebug(context, () => ({ owner, current: () => true, invoke: async (action, observationId, afterSequence) => runtime.run({ action, observationId, afterSequence, expectedOwner: owner }, bridge) }))
    const first = debug.subscribe(() => {})
    const second = debug.subscribe(() => {})
    try {
      await Promise.all([first.ready, second.ready])
      await first.unsubscribe()
      await expect(first.closed).resolves.toBeUndefined()
      const loss = second.closed.catch(error => error)
      runtime.close()
      const timeout = AbortSignal.timeout(2000)
      const result = await Promise.race([loss, new Promise((_resolve, reject) => timeout.addEventListener('abort', () => reject(new Error('Diagnostic loss not reported')), { once: true }))])
      expect(result).toMatchObject({ code: 'SOURCE_UNAVAILABLE' })
      expect(debug.getSnapshot().items).toEqual([])
      await expect(second.unsubscribe()).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' })
    }
    finally {
      await first.unsubscribe()
      await second.unsubscribe().catch(() => {})
      runtime.close()
    }
  })

  it('preserves typed start errors while reporting observation closure', async () => {
    const { runtime, context } = fixture()
    runtime.close()
    const debug = createSessionDebug(context, () => ({ owner, current: () => true, invoke: async (action, observationId, afterSequence) => runtime.run({ action, observationId, afterSequence, expectedOwner: owner }, bridge) }))
    const handle = debug.subscribe(() => {})
    const closed = handle.closed.catch(error => error)
    try {
      await expect(handle.ready).rejects.toMatchObject({ code: 'RUNTIME_CHANGED', message: 'Diagnostic observation is closed' })
      expect(await closed).toMatchObject({ code: 'SOURCE_UNAVAILABLE' })
      await expect(handle.unsubscribe()).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' })
    }
    finally { await handle.unsubscribe().catch(() => {}) }
  })

  it('reports a stop failure rather than claiming observer cleanup', async () => {
    const { runtime, context } = fixture()
    const debug = createSessionDebug(context, () => ({ owner, current: () => true, invoke: async (action, observationId, afterSequence) => runtime.run({ action, observationId, afterSequence, expectedOwner: owner }, bridge) }))
    const handle = debug.subscribe(() => {})
    await handle.ready
    runtime.close()
    const closing = handle.unsubscribe()
    expect(handle.unsubscribe()).toBe(closing)
    await expect(closing).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' })
  })

  it('bounds cleanup when a registration never settles', async () => {
    const { runtime, context } = fixture()
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const debug = createSessionDebug(context, () => ({
      owner,
      current: () => true,
      async invoke(action, observationId, afterSequence) {
        const page = runtime.run({ action, observationId, afterSequence, expectedOwner: owner }, bridge)
        if (action === 'start') {
          started.resolve()
          await release.promise
        }
        return page
      },
    }))
    const handle = debug.subscribe(() => {})
    void handle.ready.catch(() => {})
    try {
      await started.promise
      await expect(handle.unsubscribe()).rejects.toMatchObject({ code: 'TIMEOUT' })
    }
    finally {
      release.resolve()
      runtime.close()
    }
  }, 8000)

  it('joins a late registration after an early stop could not find it', async () => {
    const { target, runtime, context } = fixture()
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    let firstId: string | undefined
    const debug = createSessionDebug(context, () => ({
      owner,
      current: () => true,
      async invoke(action, observationId, afterSequence) {
        if (action === 'start' && !firstId) {
          firstId = observationId
          started.resolve()
          await release.promise
        }
        return runtime.run({ action, observationId, afterSequence, expectedOwner: owner }, bridge)
      },
    }))
    let successor: ReturnType<typeof debug.subscribe> | undefined
    const first = debug.subscribe(() => {})
    void first.ready.catch(() => {})
    try {
      await started.promise
      const cleanup = first.unsubscribe()
      successor = debug.subscribe(() => {})
      await successor.ready
      release.resolve()
      await cleanup
      target.console.log('successor survives')
      await expect.poll(() => debug.getSnapshot().items.map(item => item.message), { timeout: 2000 }).toContain('successor survives')
    }
    finally {
      release.resolve()
      await first.unsubscribe()
      await successor?.unsubscribe()
      runtime.close()
    }
  })
})
