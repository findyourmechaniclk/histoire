import type { HistoireRequestCapture } from '../adapters/types.js'
import { expect, it } from 'vitest'
import { createHistoireSessionWithAdapters } from '../internal.js'
import { deferred, sourceFixture } from './fixtures/session.js'

/** External runtime response fixture; public session and lifetime logic remain real. */
function variantResult(capture: HistoireRequestCapture, value: number) {
  return { mode: 'live', inspection: 'variant', owner: { sourceId: capture.sourceId, epoch: capture.epoch, revision: capture.revision, runtimeId: capture.runtimeId, target: capture.target }, observedAt: '2026-01-01T00:00:00.000Z', durationMs: 1, truncated: false, state: { count: value }, components: [], propsAvailable: false, omittedValues: 0 }
}

it('addresses an explicit mounted target without changing selection and detaches returned state', async () => {
  const fixture = sourceFixture()
  fixture.descriptor.inspection = { variant: { available: true } }
  const session = createHistoireSessionWithAdapters({ url: 'https://book.test/' }, fixture.adapters)
  const delegate = fixture.request.getMockImplementation()!
  const received: { target: unknown, envelope: unknown }[] = []
  fixture.request.mockImplementation(async (command, payload, capture?: HistoireRequestCapture) => {
    if (command === 'inspection.variant') {
      received.push({ target: structuredClone(payload.target), envelope: structuredClone(capture!.target) })
      return variantResult(capture!, 37)
    }
    return delegate(command, payload)
  })
  try {
    await session.connect()
    await session.selection.select({ storyId: 'a:b', variantId: 'c' })
    await session.mount({} as HTMLElement, { surface: 'preview' }).ready
    const target = { storyId: 'a:b', variantId: 'other' }
    const result = await session.inspect.variant({ target })
    expect(received).toEqual([{ target: { storyId: 'a:b', variantId: 'other' }, envelope: { storyId: 'a:b', variantId: 'other' } }])
    expect(result.state).toEqual({ count: 37 })
    expect(result.owner.target).toEqual(target)
    expect(session.getSnapshot().selection).toEqual({ storyId: 'a:b', variantId: 'c' })
    expect(Object.isFrozen(result.state)).toBe(true)
  }
  finally { await session.dispose() }
})

it('rejects held inspection after runtime replacement, including a late failure', async () => {
  const fixture = sourceFixture()
  fixture.descriptor.inspection = { variant: { available: true } }
  const session = createHistoireSessionWithAdapters({ url: 'https://book.test/' }, fixture.adapters)
  const held = deferred<unknown>()
  const started = deferred<void>()
  const delegate = fixture.request.getMockImplementation()!
  fixture.request.mockImplementation(async (command, payload) => {
    if (command === 'inspection.variant') {
      started.resolve()
      return held.promise
    }
    return delegate(command, payload)
  })
  try {
    await session.connect()
    await session.selection.select({ storyId: 'a:b', variantId: 'c' })
    await session.mount({} as HTMLElement, { surface: 'preview' }).ready
    const pending = session.inspect.variant()
    await started.promise
    fixture.reload()
    await expect(pending).rejects.toMatchObject({ code: 'RUNTIME_CHANGED' })
    held.reject(new Error('late failure'))
  }
  finally { await session.dispose() }
})

it('rejects accessor-bearing options without executing caller code', async () => {
  const fixture = sourceFixture()
  fixture.descriptor.inspection = { dom: { available: true } }
  const session = createHistoireSessionWithAdapters({ url: 'https://book.test/' }, fixture.adapters)
  let reads = 0
  const options = Object.defineProperty({}, 'selector', { enumerable: true, get() {
    reads++
    return 'button'
  } })
  try {
    await session.connect()
    await session.selection.select({ storyId: 'a:b', variantId: 'c' })
    await session.mount({} as HTMLElement, { surface: 'preview' }).ready
    await expect(session.inspect.dom(options)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    expect(reads).toBe(0)
  }
  finally { await session.dispose() }
})

it('advertises only source grants backed by the current ready actor', async () => {
  const fixture = sourceFixture()
  fixture.descriptor.inspection = { components: { available: true } }
  const mount = fixture.adapters.mount!
  fixture.adapters.mount = (context) => {
    const surface = mount(context)
    return { ...surface, ready: surface.ready.then(runtime => runtime && ({ ...runtime, inspection: {} })) }
  }
  const session = createHistoireSessionWithAdapters({ url: 'https://book.test/' }, fixture.adapters)
  try {
    await session.connect()
    expect(session.getSnapshot().inspection?.components?.available).toBe(false)
    await session.selection.select({ storyId: 'a:b', variantId: 'c' })
    await session.mount({} as HTMLElement, { surface: 'preview' }).ready
    expect(session.getSnapshot().inspection?.components?.available).toBe(false)
    await expect(session.inspect.components()).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
    fixture.ready()
    expect(session.getSnapshot().inspection?.components?.available).toBe(true)
    fixture.descriptor.inspection.components = { available: false }
    fixture.emitCatalog()
    expect(session.getSnapshot().inspection?.components?.available).toBe(false)
  }
  finally { await session.dispose() }
})
