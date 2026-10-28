import type { HistoireRequestCapture } from '../adapters/types.js'
import { expect, it } from 'vitest'
import { createHistoireSessionWithAdapters } from '../internal.js'
import { deferred, sourceFixture } from './fixtures/session.js'

it('requires component highlight capability on admission and completion without blocking selector highlights', async () => {
  const fixture = sourceFixture()
  fixture.descriptor.inspection = { highlight: { available: true }, componentHighlight: { available: false } }
  const session = createHistoireSessionWithAdapters({ url: 'https://book.test/' }, fixture.adapters)
  const delegate = fixture.request.getMockImplementation()!
  const held = deferred<unknown>()
  const started = deferred<void>()
  let hold = false
  const calls: unknown[] = []
  fixture.request.mockImplementation(async (command, payload, capture?: HistoireRequestCapture) => {
    if (command === 'inspection.highlight') {
      calls.push(structuredClone(payload))
      if (hold) {
        started.resolve()
        return held.promise
      }
      return { owner: { sourceId: capture!.sourceId, epoch: capture!.epoch, revision: capture!.revision, runtimeId: capture!.runtimeId, target: capture!.target }, observedAt: '2026-10-28T12:00:00.000Z' }
    }
    return delegate(command, payload)
  })
  try {
    await session.connect()
    await session.selection.select({ storyId: 'a:b', variantId: 'c' })
    await session.mount({} as HTMLElement, { surface: 'preview' }).ready
    await expect(session.inspect.highlight({ componentId: 'node' })).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
    expect(calls).toEqual([])
    await expect(session.inspect.highlight({ selector: '#target' })).resolves.toMatchObject({ observedAt: '2026-10-28T12:00:00.000Z' })
    fixture.descriptor.inspection.componentHighlight = { available: true }
    fixture.emitCatalog()
    fixture.ready()
    await expect(session.inspect.highlight({ componentId: 'node' })).resolves.toMatchObject({ observedAt: '2026-10-28T12:00:00.000Z' })
    expect(calls[1]).toEqual({ componentId: 'node', target: { storyId: 'a:b', variantId: 'c' } })
    hold = true
    const pending = session.inspect.highlight({ componentId: 'node' })
    const rejected = expect(pending).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
    await started.promise
    for (const listener of fixture.frameListeners) listener({ type: 'runtime', ...fixture.owner(), runtime: { ...fixture.runtime(), inspection: { highlight: { available: true }, componentHighlight: { available: false } } } })
    held.resolve({ owner: { sourceId: fixture.descriptor.sourceId, epoch: fixture.descriptor.epoch, revision: fixture.descriptor.revision, runtimeId: 'document-1', target: { storyId: 'a:b', variantId: 'c' } }, observedAt: '2026-10-28T12:00:00.000Z' })
    await rejected
    fixture.ready()
    fixture.descriptor.inspection.componentHighlight = { available: false }
    fixture.emitCatalog()
    await expect(session.inspect.highlight({ componentId: 'node' })).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
    expect(calls).toHaveLength(3)
  }
  finally {
    held.resolve(undefined)
    await session.dispose()
  }
})

it('clears an owned highlight even when ordinary inspection capacity is exhausted', async () => {
  const fixture = sourceFixture()
  fixture.descriptor.inspection = { variant: { available: true }, highlightLease: { available: true } }
  const session = createHistoireSessionWithAdapters({ url: 'https://book.test/' }, fixture.adapters)
  const delegate = fixture.request.getMockImplementation()!
  const held = deferred<unknown>()
  let entered = 0
  const started = deferred<void>()
  fixture.request.mockImplementation(async (command, payload, capture?: HistoireRequestCapture) => {
    if (command === 'inspection.variant') {
      if (++entered === 16) started.resolve()
      return held.promise
    }
    if (command === 'inspection.highlightClear') return { owner: { sourceId: capture!.sourceId, epoch: capture!.epoch, revision: capture!.revision, runtimeId: capture!.runtimeId, target: capture!.target }, cleared: true }
    return delegate(command, payload)
  })
  try {
    await session.connect()
    await session.selection.select({ storyId: 'a:b', variantId: 'c' })
    await session.mount({} as HTMLElement, { surface: 'preview' }).ready
    const pending = Array.from({ length: 16 }, () => session.inspect.variant().catch(() => {}))
    await started.promise
    await expect(session.inspect.variant()).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    const owner = { sourceId: fixture.descriptor.sourceId, epoch: fixture.descriptor.epoch, revision: fixture.descriptor.revision, runtimeId: 'document-1', target: { storyId: 'a:b', variantId: 'c' } }
    await expect(session.inspect.clearHighlight({ target: owner.target, expectedOwner: owner, leaseId: 'lease' })).resolves.toMatchObject({ cleared: true })
    await session.dispose()
    await Promise.all(pending)
  }
  finally {
    held.resolve(undefined)
    await session.dispose()
  }
})
