import type { FrameRef, PluginChannel, PluginFrameRef, WorkbenchPluginApi } from '../index.js'
import { describe, expect, it, vi } from 'vitest'
import { PLUGIN_FRAMES_SERVICE } from '../host/frames.js'
import { createTestContext, createTestHost, plugin } from './fixtures/host.js'

const frame: FrameRef = { key: 'frame-1', target: { storyId: 'story', variantId: 'variant' } }

/** Host whose root context carries a frame service double; returns the captured plugin API. */
async function hostWithFrames() {
  const errors = new Set<(error: Error) => void>()
  const changes = new Set<() => void>()
  const signals: AbortSignal[] = []
  const channel = { post: vi.fn(async () => {}), on: vi.fn(() => () => {}), getDroppedCount: () => 0 } satisfies PluginChannel
  const service = {
    list: vi.fn((pluginId: string): PluginFrameRef[] => [{ ...frame, actorId: `${pluginId}-actor` }]),
    open: vi.fn((_pluginId: string, _frame: FrameRef, signal: AbortSignal) => {
      signals.push(signal)
      return channel
    }),
    onError: vi.fn((_pluginId: string, listener: (error: Error) => void) => {
      errors.add(listener)
      return () => errors.delete(listener)
    }),
    subscribe: vi.fn((listener: () => void) => {
      changes.add(listener)
      return () => changes.delete(listener)
    }),
  }
  const context = Object.assign(createTestContext(), { [PLUGIN_FRAMES_SERVICE]: service })
  let api!: WorkbenchPluginApi
  const host = createTestHost([plugin('probe', (value) => {
    api = value
  })], { context })
  await host.ready
  return { host, api, service, channel, signals, errors, changes }
}

describe('plugin frames API', () => {
  it('lists and opens frames of its own plugin through the host frame service', async () => {
    const { api, service, channel } = await hostWithFrames()
    expect(api.frames.list()).toEqual([{ ...frame, actorId: 'probe-actor' }])
    expect(api.frames.open(frame)).toBe(channel)
    expect(service.open).toHaveBeenCalledWith('probe', frame, expect.any(AbortSignal))
  })

  it('closes channels and records frame failures with the plugin lifetime', async () => {
    const { host, api, signals, errors } = await hostWithFrames()
    api.frames.open(frame)
    for (const listener of errors) listener(new Error('frame attach failed: boom'))
    expect(host.diagnostics()).toEqual([expect.objectContaining({ pluginId: 'probe', phase: 'report' })])
    await host.dispose()
    expect(signals[0].aborted).toBe(true)
    expect(errors.size).toBe(0)
    expect(api.frames.list()).toEqual([])
    expect(() => api.frames.open(frame)).toThrowError(expect.objectContaining({ code: 'RUNTIME_CHANGED' }))
  })

  it('notifies attach and detach of its own frames until the plugin is disposed', async () => {
    const { host, api, service, changes } = await hostWithFrames()
    const listener = vi.fn()
    api.frames.subscribe(listener)
    const notify = () => [...changes].forEach(change => change())
    // Another plugin's actors changed: this plugin's list is identical.
    notify()
    expect(listener).not.toHaveBeenCalled()
    service.list.mockImplementation(pluginId => [{ ...frame, actorId: `${pluginId}-next` }])
    notify()
    expect(listener).toHaveBeenCalledTimes(1)
    await host.dispose()
    expect(changes.size).toBe(0)
  })

  it('reports frames as unavailable in hosts without frame messaging', async () => {
    let api!: WorkbenchPluginApi
    const host = createTestHost([plugin('probe', (value) => {
      api = value
    })])
    await host.ready
    expect(api.frames.list()).toEqual([])
    expect(() => api.frames.open(frame)).toThrowError(expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' }))
    expect(api.frames.subscribe(() => {})).toBeTypeOf('function')
  })
})
