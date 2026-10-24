// @vitest-environment jsdom
import { HOST_CHANNEL_MESSAGE, RUNTIME_REQUEST, RUNTIME_RESULT, VARIANT_READY } from '@histoire/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeFrameFixture, publishFrameMessage } from '../utils/embed/runtime-frame.js'
import { flushMicrotasks } from '../utils/flush.js'

/** Real SDK session and runtime iframe adapter of a book advertising one frame plugin. */
async function readyFrame() {
  const fixture = await createRuntimeFrameFixture({ framePlugins: [{ id: 'probe', apiVersion: 1 }] })
  const frame = fixture.container.querySelector('iframe')!
  const post = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {})
  publishFrameMessage(frame, VARIANT_READY)
  await fixture.primary.ready
  vi.advanceTimersToNextFrame()
  /**
   * Publishes one plugin body from the runtime document.
   * @param plugin Plugin body.
   * @param patch Envelope overrides (forged identities).
   */
  const plugin = (plugin: Record<string, unknown>, patch: Record<string, unknown> = {}) => publishFrameMessage(frame, HOST_CHANNEL_MESSAGE, undefined, { plugin: { pluginId: 'probe', actorId: 'actor-1', data: null, ...plugin }, ...patch })
  return { ...fixture, frame, post, plugin, plugins: fixture.session.plugins! }
}

describe('embed wrapper plugin relay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('ResizeObserver', class {
      /** Geometry stays outside transport assertions. */
      observe = vi.fn()
      /** Fixture must release document observer. */
      disconnect = vi.fn()
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('round-trips between the SDK and one actor of the owned document', async () => {
    const test = await readyFrame()
    try {
      test.plugin({ type: 'histoire:attached' })
      expect(test.plugins.actors('probe')).toEqual([{ pluginId: 'probe', actorId: 'actor-1', target: { storyId: 'a:b', variantId: 'c' }, runtimeId: expect.any(String) }])
      const channel = test.plugins.open('probe', { actorId: 'actor-1' })
      const received = vi.fn()
      channel.on('pong', received)
      test.plugin({ type: 'pong', data: { value: 1 } })
      expect(received).toHaveBeenCalledWith({ value: 1 }, expect.objectContaining({ actorId: 'actor-1', target: { storyId: 'a:b', variantId: 'c' } }))

      const posting = channel.post('ping', { value: 2 })
      await flushMicrotasks()
      const request = test.post.mock.calls.map(([message]) => message).find(message => message.type === RUNTIME_REQUEST)
      expect(request).toMatchObject({ command: 'plugin.post', payload: { pluginId: 'probe', actorId: 'actor-1', type: 'ping', data: { value: 2 } }, documentId: test.session.getSnapshot().runtime.runtimeId })
      publishFrameMessage(test.frame, RUNTIME_RESULT, undefined, { requestId: request.requestId, result: null })
      await expect(posting).resolves.toBeUndefined()
    }
    finally {
      await test.close()
    }
  })

  it.each(['source', 'origin', 'document', 'plugin', 'story'] as const)('drops plugin traffic with a forged %s', async (field) => {
    const test = await readyFrame()
    try {
      test.plugin({ type: 'histoire:attached' })
      const received = vi.fn()
      test.plugins.open('probe', { actorId: 'actor-1' }).on('pong', received)
      const data = { __histoire: true, type: HOST_CHANNEL_MESSAGE, documentId: test.session.getSnapshot().runtime.runtimeId, selectionVersion: 0, storyId: 'a:b', variantId: 'c', plugin: { pluginId: 'probe', actorId: 'actor-1', type: 'pong', data: null } }
      if (field === 'document') data.documentId = 'retired'
      if (field === 'plugin') data.plugin.pluginId = 'undeclared'
      if (field === 'story') data.storyId = 'a'
      window.dispatchEvent(new MessageEvent('message', { source: field === 'source' ? window : test.frame.contentWindow, origin: field === 'origin' ? 'https://foreign.example' : window.location.origin, data }))
      expect(received).not.toHaveBeenCalled()
    }
    finally {
      await test.close()
    }
  })

  it('rejects a pending post at once when its actor detaches and cancels the runtime request', async () => {
    const test = await readyFrame()
    try {
      test.plugin({ type: 'histoire:attached' })
      const channel = test.plugins.open('probe', { actorId: 'actor-1' })
      const posting = channel.post('ping', null)
      await flushMicrotasks()
      test.plugin({ type: 'histoire:detached' })
      await expect(posting).rejects.toMatchObject({ code: 'RUNTIME_CHANGED' })
      expect(test.plugins.actors('probe')).toEqual([])
      // A late reply to the cancelled request settles nothing and replays nothing.
      const request = test.post.mock.calls.map(([message]) => message).find(message => message.type === RUNTIME_REQUEST)
      publishFrameMessage(test.frame, RUNTIME_RESULT, undefined, { requestId: request.requestId, result: null })
      await expect(channel.post('ping', null)).rejects.toMatchObject({ code: 'RUNTIME_CHANGED' })
    }
    finally {
      await test.close()
    }
  })
})
