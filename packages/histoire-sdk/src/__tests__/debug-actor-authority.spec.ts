import type { HistoireRequestCapture } from '../adapters/types.js'
import { expect, it } from 'vitest'
import { createHistoireSessionWithAdapters } from '../internal.js'
import { sourceFixture } from './fixtures/session.js'

it('requires current actor diagnostics and stops observing when that grant is withdrawn', async () => {
  const fixture = sourceFixture()
  fixture.descriptor.inspection = { diagnostics: { available: true } }
  const mount = fixture.adapters.mount!
  fixture.adapters.mount = (context) => {
    const surface = mount(context)
    return { ...surface, ready: surface.ready.then(runtime => runtime && ({ ...runtime, inspection: {} })) }
  }
  const calls: string[] = []
  const delegate = fixture.request.getMockImplementation()!
  fixture.request.mockImplementation(async (command, payload, capture?: HistoireRequestCapture) => {
    if (command !== 'inspection.debug') return delegate(command, payload)
    calls.push(payload.action)
    return { mode: 'live', inspection: 'debug', owner: payload.expectedOwner, observedAt: '2026-01-01T00:00:00.000Z', durationMs: 1, truncated: false, items: [], nextSequence: 0, oldestSequence: 1, droppedCount: 0, gap: false }
  })
  const session = createHistoireSessionWithAdapters({ url: 'https://book.test/' }, fixture.adapters)
  let handle: ReturnType<typeof session.debug.subscribe> | undefined
  try {
    await session.connect()
    await session.selection.select({ storyId: 'a:b', variantId: 'c' })
    await session.mount({} as HTMLElement, { surface: 'preview' }).ready
    expect(() => session.debug.subscribe(() => {})).toThrow('Diagnostics unavailable')
    expect(calls).toEqual([])
    fixture.ready()
    handle = session.debug.subscribe(() => {})
    await handle.ready
    expect(calls).toEqual(['start'])
    const runtime = { ...fixture.runtime(), inspection: {} }
    for (const listener of fixture.frameListeners) listener({ type: 'runtime', ...fixture.owner(), runtime })
    await expect.poll(() => calls.includes('stop')).toBe(true)
    expect(() => session.debug.subscribe(() => {})).toThrow('Diagnostics unavailable')
  }
  finally {
    await handle?.unsubscribe()
    await session.dispose()
  }
})
