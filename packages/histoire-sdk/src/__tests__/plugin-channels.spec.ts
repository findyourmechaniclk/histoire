import type { HistoireJsonValue } from '@histoire/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHistoireSessionWithAdapters } from '../session/controller.js'
import { deferred, sourceFixture } from './fixtures/session.js'

afterEach(() => vi.restoreAllMocks())

type Fixture = ReturnType<typeof sourceFixture>

/** Book advertising one frame plugin, optionally with an unsupported contract version. */
function pluginFixture(apiVersion = 1) {
  const fixture = sourceFixture()
  fixture.descriptor.framePlugins = [{ id: 'probe', apiVersion }]
  fixture.descriptor.capabilities.framePlugins = { available: true }
  return fixture
}

/**
 * Publishes one plugin message from the fixture's runtime document.
 * @param fixture Session fixture.
 * @param actorId Sending actor.
 * @param type Plugin message type or runtime notice.
 * @param data JSON body.
 * @param patch Overrides of the attributed message (forged identities).
 */
function frame(fixture: Fixture, actorId: string, type: string, data: HistoireJsonValue = null, patch: Record<string, unknown> = {}) {
  const message = { pluginId: 'probe', actorId, type, data, target: { storyId: 'a:b', variantId: 'c' }, runtimeId: fixture.runtime().runtimeId, ...patch }
  for (const listener of fixture.frameListeners) listener({ type: 'plugin', ...fixture.owner(), message } as any)
}

/** Connected session with a ready primary preview. */
async function mounted(fixture: Fixture) {
  const session = createHistoireSessionWithAdapters({ url: 'https://book.test/' }, fixture.adapters)
  await session.connect()
  await session.selection.select({ storyId: 'a:b', variantId: 'c' })
  await session.mount({} as HTMLElement, { surface: 'preview' }).ready
  return session
}

describe('session plugin channels', () => {
  it('lists frame plugins from a data-only connection without mounting any story', async () => {
    const fixture = pluginFixture()
    const session = createHistoireSessionWithAdapters({ url: 'https://book.test/' }, fixture.adapters)
    expect(() => session.plugins!.frames()).toThrowError(expect.objectContaining({ code: 'NOT_CONNECTED' }))
    await session.connect()
    expect(session.plugins!.frames()).toEqual([{ id: 'probe', apiVersion: 1 }])
    expect(session.plugins!.actors('probe')).toEqual([])
    expect(() => session.plugins!.open('other', { actorId: 'x' })).toThrowError(expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' }))
    expect(() => session.plugins!.open('probe', { actorId: 'x' })).toThrowError(expect.objectContaining({ code: 'RUNTIME_CHANGED' }))
    expect(fixture.adapters.mount).not.toHaveBeenCalled()
    await session.dispose()
  })

  it('rejects an unsupported frame contract version distinctly', async () => {
    const fixture = pluginFixture(2)
    const session = await mounted(fixture)
    frame(fixture, 'actor-1', 'histoire:attached')
    expect(() => session.plugins!.open('probe', { actorId: 'actor-1' })).toThrowError(expect.objectContaining({ code: 'PROTOCOL_MISMATCH' }))
    await session.dispose()
  })

  it('exchanges messages with exactly one actor and counts rejected traffic per plugin', async () => {
    const fixture = pluginFixture()
    const session = await mounted(fixture)
    const changes = vi.fn()
    session.plugins!.subscribe(changes)
    frame(fixture, 'actor-1', 'histoire:attached')
    frame(fixture, 'actor-2', 'histoire:attached')
    expect(changes).toHaveBeenCalledTimes(2)
    expect(session.plugins!.actors('probe').map(actor => actor.actorId)).toEqual(['actor-1', 'actor-2'])
    const first = session.plugins!.open('probe', { actorId: 'actor-1' })
    const received = vi.fn()
    first.on('pong', received)

    fixture.request.mockImplementation(async () => null)
    await first.post('ping', { value: 1 })
    expect(fixture.request).toHaveBeenLastCalledWith('plugin.post', { pluginId: 'probe', actorId: 'actor-1', type: 'ping', data: { value: 1 } }, expect.objectContaining({ runtimeId: 'document-1' }))

    frame(fixture, 'actor-2', 'pong', 'other actor')
    frame(fixture, 'actor-1', 'pong', 'mine')
    expect(received).toHaveBeenCalledOnce()
    expect(received).toHaveBeenCalledWith('mine', { pluginId: 'probe', actorId: 'actor-1', type: 'pong', data: 'mine', target: { storyId: 'a:b', variantId: 'c' } })

    frame(fixture, 'actor-1', 'pong', null, { runtimeId: 'retired-document' })
    frame(fixture, 'actor-9', 'pong')
    frame(fixture, 'actor-1', 'pong', null, { pluginId: 'other' })
    frame(fixture, 'actor-1', 'pong', null, { target: { storyId: 'a', variantId: 'b:c' } })
    expect(received).toHaveBeenCalledOnce()
    expect(first.getDroppedCount()).toBe(3)
    first.on('fail', () => {
      throw new Error('consumer failure')
    })
    frame(fixture, 'actor-1', 'fail')
    expect(first.getDroppedCount()).toBe(4)
    await expect(first.post('histoire:attached', null)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await session.dispose()
  })

  it('retires pending posts and listeners on detach and never replays', async () => {
    const fixture = pluginFixture()
    const session = await mounted(fixture)
    frame(fixture, 'actor-1', 'histoire:attached')
    const channel = session.plugins!.open('probe', { actorId: 'actor-1' })
    const received = vi.fn()
    channel.on('pong', received)
    const pending = deferred<null>()
    fixture.request.mockImplementation(() => pending.promise)
    const post = channel.post('ping', null)
    frame(fixture, 'actor-1', 'histoire:detached')
    await expect(post).rejects.toMatchObject({ code: 'RUNTIME_CHANGED' })
    expect(session.plugins!.actors('probe')).toEqual([])
    frame(fixture, 'actor-1', 'pong')
    frame(fixture, 'actor-3', 'histoire:attached')
    frame(fixture, 'actor-3', 'pong')
    expect(received).not.toHaveBeenCalled()
    await expect(channel.post('ping', null)).rejects.toMatchObject({ code: 'RUNTIME_CHANGED' })
    pending.resolve(null)
    await session.dispose()
  })

  it('retires actors when the runtime document is replaced or the source disconnects', async () => {
    const fixture = pluginFixture()
    const session = await mounted(fixture)
    frame(fixture, 'actor-1', 'histoire:attached')
    const replaced = session.plugins!.open('probe', { actorId: 'actor-1' })
    fixture.reload()
    await expect(replaced.post('ping', null)).rejects.toMatchObject({ code: 'RUNTIME_CHANGED' })
    fixture.ready()
    frame(fixture, 'actor-2', 'histoire:attached')
    const disconnected = session.plugins!.open('probe', { actorId: 'actor-2' })
    fixture.emitDisconnect()
    await expect(disconnected.post('ping', null)).rejects.toMatchObject({ code: 'NOT_CONNECTED' })
    await session.dispose()
  })
})
