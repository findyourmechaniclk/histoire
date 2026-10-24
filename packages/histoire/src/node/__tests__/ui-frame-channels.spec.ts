// @vitest-environment jsdom
import type { FrameDocument } from '../../../../histoire-app/src/app/extensions/frame-channels.js'
import type { WorkbenchPluginApi } from '../../../../histoire-plugin-kit/src/index.js'
import { getHistoireTargetKey, HOST_CHANNEL_MESSAGE } from '@histoire/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCanvasFrames } from '../../../../histoire-app/src/app/composables/canvas-settings.js'
import { createCanvasStore } from '../../../../histoire-app/src/app/stores/canvas.js'
import { defineWorkbenchPlugin } from '../../../../histoire-plugin-kit/src/index.js'
import { createSnapshotSession, createTestWorkbenchHost, pluginEntry } from './utils/workbench-extensions.js'

const target = { storyId: 'a:b', variantId: 'c' }
const cleanups: (() => unknown)[] = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
  document.body.innerHTML = ''
})

/**
 * Canvas-shaped registry of two frames rendering the same variant, plus a captured plugin API.
 * @param framePlugins Installed frame plugins.
 * @param ids Frame keys.
 * @param canvas Uses the real (reactive) canvas frame registry; `release` unregisters a frame.
 */
async function workbench(framePlugins = [{ id: 'probe', apiVersion: 1 }], ids = ['frame-1', 'frame-2'], canvas = false) {
  const sent: { id: string, payload: Record<string, any> }[] = []
  const canvasFrames = canvas ? createCanvasFrames(createCanvasStore()) : undefined
  const frames: Map<string, FrameDocument> = canvasFrames?.frames ?? new Map()
  const release = new Map<string, () => void>()
  for (const id of ids) {
    const iframe = document.createElement('iframe')
    document.body.append(iframe)
    const frame = { id, ...target, iframe, documentId: `${id}-document` }
    if (canvasFrames) release.set(id, canvasFrames.registerFrame({ ...frame, rect: { x: 0, y: 0, width: 1, height: 1 } }))
    else frames.set(id, frame)
  }
  const registry = canvasFrames ?? { frames, postToFrame: (id: string, payload: Record<string, unknown>) => Boolean(sent.push({ id, payload })) }
  let api!: WorkbenchPluginApi
  const { workbench } = createTestWorkbenchHost({
    plugins: [pluginEntry(defineWorkbenchPlugin({ id: 'probe', apiVersion: 1, setup: (value) => {
      api = value
    } }))],
    framePlugins: () => framePlugins,
  })
  cleanups.push(() => workbench.dispose(), workbench.frames.registerFrames(registry, window))
  await workbench.host.ready
  return { workbench, frames, sent, api, release }
}

/**
 * Dispatches one plugin body as the frame document would post it.
 * @param frame Sending frame (its window and current document by default).
 * @param plugin Plugin body fields.
 * @param patch Event or envelope overrides (forged identities).
 * @param patch.source Sender window.
 * @param patch.origin Sender origin.
 * @param patch.documentId Sender document identity.
 */
function post(frame: FrameDocument, plugin: Record<string, unknown>, patch: { source?: Window | null, origin?: string, documentId?: string } = {}) {
  const data = { __histoire: true, type: HOST_CHANNEL_MESSAGE, documentId: patch.documentId ?? frame.documentId, ...target, plugin: { pluginId: 'probe', actorId: `${frame.id}-actor`, data: null, ...plugin } }
  window.dispatchEvent(new MessageEvent('message', { source: patch.source === undefined ? frame.iframe!.contentWindow : patch.source, origin: patch.origin ?? window.location.origin, data }))
}

describe('standalone frame plugin channels', () => {
  it('keeps two frames of the same variant apart', async () => {
    const { frames, sent, api } = await workbench()
    for (const frame of frames.values()) post(frame, { type: 'histoire:attached' })
    expect(api.context.capabilities.has('frames')).toBe(true)
    expect(api.frames.list()).toEqual([{ key: 'frame-1', target, actorId: 'frame-1-actor' }, { key: 'frame-2', target, actorId: 'frame-2-actor' }])
    const channel = api.frames.open({ key: 'frame-1', target })
    const received = vi.fn()
    channel.on('pong', received)
    post(frames.get('frame-2')!, { type: 'pong', data: 'other frame' })
    post(frames.get('frame-1')!, { type: 'pong', data: 'mine' })
    expect(received).toHaveBeenCalledOnce()
    expect(received).toHaveBeenCalledWith('mine', expect.objectContaining({ actorId: 'frame-1-actor', target }))
    await channel.post('ping', 1)
    expect(sent).toEqual([{ id: 'frame-1', payload: { type: HOST_CHANNEL_MESSAGE, ...target, plugin: { pluginId: 'probe', actorId: 'frame-1-actor', type: 'ping', data: 1 } } }])
  })

  it('rejects and counts forged source, origin, document, actor and plugin', async () => {
    const { frames, api } = await workbench()
    const frame = frames.get('frame-1')!
    post(frame, { type: 'histoire:attached' })
    const channel = api.frames.open({ key: 'frame-1', target })
    const received = vi.fn()
    channel.on('pong', received)
    post(frame, { type: 'pong' }, { source: frames.get('frame-2')!.iframe!.contentWindow })
    post(frame, { type: 'pong' }, { origin: 'https://foreign.example' })
    post(frame, { type: 'pong' }, { documentId: 'retired-document' })
    post(frame, { type: 'pong', actorId: 'forged-actor' })
    post(frame, { type: 'pong', pluginId: 'other' })
    expect(received).not.toHaveBeenCalled()
    expect(channel.getDroppedCount()).toBe(4)
  })

  it('notifies attach and detach, and retires channels when the actor detaches or its document is replaced', async () => {
    const { frames, api } = await workbench()
    const [first, second] = frames.values()
    const changed = vi.fn()
    api.frames.subscribe(changed)
    for (const frame of [first, second]) post(frame, { type: 'histoire:attached' })
    expect(changed).toHaveBeenCalledTimes(2)
    const detached = api.frames.open(api.frames.list().find(frame => frame.actorId === 'frame-1-actor')!)
    const received = vi.fn()
    detached.on('pong', received)
    post(first, { type: 'histoire:detached' })
    expect(changed).toHaveBeenCalledTimes(3)
    post(first, { type: 'pong' })
    expect(received).not.toHaveBeenCalled()
    await expect(detached.post('ping', null)).rejects.toMatchObject({ code: 'RUNTIME_CHANGED' })

    const navigated = api.frames.open({ key: 'frame-2', target })
    second.documentId = 'frame-2-next-document'
    await expect(navigated.post('ping', null)).rejects.toMatchObject({ code: 'RUNTIME_CHANGED' })
    expect(api.frames.list()).toEqual([])
    expect(() => api.frames.open({ key: 'frame-2', target })).toThrowError(expect.objectContaining({ code: 'PREVIEW_NOT_READY' }))
  })

  it('reports frames the canvas drops or navigates without a detach notice right away', async () => {
    const { frames, api, release } = await workbench(undefined, undefined, true)
    const [first, second] = frames.values()
    for (const frame of [first, second]) post(frame, { type: 'histoire:attached' })
    const changed = vi.fn()
    api.frames.subscribe(changed)
    // No list/open/receive in between: the registry change alone must retire the actors.
    release.get('frame-1')!()
    expect(changed).toHaveBeenCalledTimes(1)
    second.documentId = 'frame-2-next-document'
    expect(changed).toHaveBeenCalledTimes(2)
    expect(api.frames.list()).toEqual([])
  })

  it('distinguishes unavailable plugins and unsupported versions', async () => {
    await expect((async () => (await workbench([])).api.frames.open({ key: 'frame-1', target }))()).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
    await expect((async () => (await workbench([{ id: 'probe', apiVersion: 2 }])).api.frames.open({ key: 'frame-1', target }))()).rejects.toMatchObject({ code: 'PROTOCOL_MISMATCH' })
  })

  it('opens a channel to the selected canvas frame from an inspector-scoped frame ref', async () => {
    // The canvas keys the selected frame by its target key; the inspector context must match it.
    const key = getHistoireTargetKey(target)
    const { workbench: host, frames, sent, api } = await workbench(undefined, ['other', key])
    for (const frame of frames.values()) post(frame, { type: 'histoire:attached' })
    host.selectedFrame.publish(createSnapshotSession(target), key)
    const inspector = host.selectedFrame.current()!.context
    expect(inspector.frame.key).toBe(key)
    await api.frames.open(inspector.frame).post('ping', 1)
    expect(sent.map(message => [message.id, message.payload.plugin.actorId])).toEqual([[key, `${key}-actor`]])
  })

  it('records frame failures as diagnostics of the plugin', async () => {
    const { workbench: host, frames } = await workbench()
    post(frames.get('frame-1')!, { type: 'histoire:error', data: { phase: 'attach', message: 'boom' } })
    expect(host.host.diagnostics()).toEqual([expect.objectContaining({ pluginId: 'probe', phase: 'report', error: expect.objectContaining({ message: 'frame attach failed: boom' }) })])
  })
})
