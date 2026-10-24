// @vitest-environment jsdom
import type { FramePluginContext } from '../../../../histoire-plugin-kit/src/types/frame.js'
import type { FramePluginManifestEntry } from './utils/preview-runtime-app.js'
import { HOST_CHANNEL_MESSAGE, RUNTIME_REQUEST, RUNTIME_RESULT } from '@histoire/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPreviewRuntimeApp } from './utils/preview-runtime-app.js'

type Runtime = ReturnType<typeof createPreviewRuntimeApp>

const runtimes: Runtime[] = []

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.close()
  vi.restoreAllMocks()
})

/** Lets readiness frames, the manifest import and async attach hooks settle. */
async function settle(runtime: Runtime) {
  await runtime.frames()
  await new Promise(resolve => setTimeout(resolve))
}

/**
 * Plugin handing every attach context to the test.
 * @param id Plugin id.
 * @param contexts Receives each attach context.
 * @param attach Optional extra attach behavior.
 */
function plugin(id: string, contexts: FramePluginContext[], attach?: (frame: FramePluginContext) => unknown): FramePluginManifestEntry {
  return { id, apiVersion: 1, load: async () => ({ default: { id, apiVersion: 1, attach(frame: FramePluginContext) {
    contexts.push(frame)
    return attach?.(frame)
  } } }) }
}

/** Runtime with two plugins attached to its first actor. */
async function attached() {
  const probe: FramePluginContext[] = []
  const other: FramePluginContext[] = []
  const runtime = createPreviewRuntimeApp({ framePlugins: [plugin('probe', probe), plugin('other', other)] })
  runtimes.push(runtime)
  await settle(runtime)
  return { runtime, probe: probe[0], other: other[0] }
}

/** Plugin bodies the runtime posted to its host. */
function posted(runtime: Runtime) {
  return runtime.messages.filter(message => message.type === HOST_CHANNEL_MESSAGE && message.plugin).map(message => message.plugin)
}

describe('frame plugin channels', () => {
  it('announces actors after attach settles and posts plugin data addressed by actor', async () => {
    let finish!: () => void
    const contexts: FramePluginContext[] = []
    const runtime = createPreviewRuntimeApp({ framePlugins: [plugin('probe', contexts, () => new Promise<void>(resolve => finish = resolve))] })
    runtimes.push(runtime)
    await settle(runtime)
    expect(posted(runtime)).toEqual([])
    finish()
    await settle(runtime)
    const [frame] = contexts
    expect(posted(runtime)).toEqual([{ pluginId: 'probe', actorId: frame.actorId, type: 'histoire:attached', data: null }])
    expect(runtime.messages.at(-1)).toMatchObject({ storyId: 'story', variantId: 'first', documentId: 'document' })

    await frame.channel.post('hello', { value: 1 })
    expect(posted(runtime).at(-1)).toEqual({ pluginId: 'probe', actorId: frame.actorId, type: 'hello', data: { value: 1 } })
    await expect(frame.channel.post('histoire:attached', null)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(frame.channel.post('big', 'x'.repeat(65536))).rejects.toMatchObject({ code: 'RESULT_TOO_LARGE' })
    expect(frame.channel.getDroppedCount()).toBe(2)
  })

  it('delivers host messages to the addressed actor and plugin only, counting rejections', async () => {
    const { runtime, probe, other } = await attached()
    const probeListener = vi.fn()
    const otherListener = vi.fn()
    probe.channel.on('ping', probeListener)
    other.channel.on('ping', otherListener)

    await runtime.receive({ type: HOST_CHANNEL_MESSAGE, documentId: 'document', plugin: { pluginId: 'probe', actorId: probe.actorId, type: 'ping', data: 1 } })
    expect(probeListener).toHaveBeenCalledWith(1, { pluginId: 'probe', actorId: probe.actorId, target: { storyId: 'story', variantId: 'first' }, type: 'ping', data: 1 })
    expect(otherListener).not.toHaveBeenCalled()

    // Wrong document, wrong actor and malformed bodies never reach listeners.
    await runtime.receive({ type: HOST_CHANNEL_MESSAGE, documentId: 'retired', plugin: { pluginId: 'probe', actorId: probe.actorId, type: 'ping', data: 2 } })
    await runtime.receive({ type: HOST_CHANNEL_MESSAGE, documentId: 'document', plugin: { pluginId: 'probe', actorId: 'other-actor', type: 'ping', data: 3 } })
    await runtime.receive({ type: HOST_CHANNEL_MESSAGE, documentId: 'document', plugin: { pluginId: 'probe', actorId: probe.actorId, type: 'ping', data: 4, name: 'factory' } })
    expect(probeListener).toHaveBeenCalledOnce()
    expect(probe.channel.getDroppedCount()).toBe(2)
    expect(other.channel.getDroppedCount()).toBe(0)

    // Correlated runtime requests (embed/SDK path) report distinct failures.
    const request = (id: string, plugin: Record<string, unknown>) => runtime.receive({ type: RUNTIME_REQUEST, requestId: id, command: 'plugin.post', documentId: 'document', storyId: 'story', variantId: 'first', payload: plugin })
    await request('1', { pluginId: 'other', actorId: other.actorId, type: 'ping', data: 5 })
    await request('2', { pluginId: 'probe', actorId: 'retired-actor', type: 'ping', data: null })
    await request('3', { pluginId: 'missing', actorId: probe.actorId, type: 'ping', data: null })
    const results = runtime.messages.filter(message => message.type === RUNTIME_RESULT)
    expect(results.map(result => [result.requestId, result.error?.code ?? null])).toEqual([['1', null], ['2', 'RUNTIME_CHANGED'], ['3', 'CAPABILITY_UNAVAILABLE']])
    expect(otherListener).toHaveBeenCalledWith(5, expect.objectContaining({ actorId: other.actorId }))
  })

  it('rate limits each plugin independently', async () => {
    const { probe, other } = await attached()
    const codes = await Promise.all(Array.from({ length: 55 }, () => probe.channel.post('burst', null).then(() => null, error => error.code)))
    expect(codes.filter(code => code === 'RATE_LIMITED')).toHaveLength(5)
    await expect(other.channel.post('calm', null)).resolves.toBeUndefined()
  })

  it('drops listeners and rejects posts as soon as the actor detaches', async () => {
    const { runtime, probe } = await attached()
    const listener = vi.fn()
    probe.channel.on('ping', listener)
    const pending = runtime.select('second', 1)
    await settle(runtime)
    await pending
    expect(probe.signal.aborted).toBe(true)
    expect(posted(runtime).filter(body => body.type === 'histoire:detached').map(body => body.pluginId)).toEqual(['other', 'probe'])
    await runtime.receive({ type: HOST_CHANNEL_MESSAGE, documentId: 'document', plugin: { pluginId: 'probe', actorId: probe.actorId, type: 'ping', data: null } })
    expect(listener).not.toHaveBeenCalled()
    await expect(probe.channel.post('late', null)).rejects.toMatchObject({ code: 'RUNTIME_CHANGED' })
    expect(probe.channel.on('ping', listener)).toBeTypeOf('function')
  })

  it('reports plugin failures to the host instead of announcing the actor', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const runtime = createPreviewRuntimeApp({ framePlugins: [plugin('broken', [], () => {
      throw new Error('attach exploded')
    })] })
    runtimes.push(runtime)
    await settle(runtime)
    expect(posted(runtime)).toEqual([{ pluginId: 'broken', actorId: expect.any(String), type: 'histoire:error', data: { phase: 'attach', message: 'attach exploded' } }])
  })
})
