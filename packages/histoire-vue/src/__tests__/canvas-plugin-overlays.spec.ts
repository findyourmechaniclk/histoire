import type { CanvasFrames } from '../../../histoire-app/src/app/composables/canvas-settings.js'
import type { CanvasScopedContext, FrameScopedContext, WorkbenchPluginApi } from '../../../histoire-plugin-kit/src/index.js'
import { HOST_CHANNEL_MESSAGE } from '@histoire/protocol'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canvasPluginFixture } from './fixtures/canvas-plugins.js'

const replica = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('../../../histoire-app/src/app/components/canvas/frame-replica.js', () => ({ createCanvasReplicaSession: replica.create }))
afterEach(() => {
  replica.create.mockReset()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

/** Layout shift applied to every frame document box without any canvas state change. */
const shift = { x: 0, y: 0 }

/** Viewport with a passive viewport overlay, an interactive canvas overlay and a frame overlay. */
async function overlayFixture() {
  let canvasContext: CanvasScopedContext | undefined
  const frameKeys: string[] = []
  let plugin!: WorkbenchPluginApi
  const test = await canvasPluginFixture(replica.create, (api) => {
    plugin = api
    api.canvas.addOverlay({ id: 'hud', space: 'viewport', mount: (element, context) => {
      canvasContext = context
      element.textContent = 'hud'
    } })
    api.canvas.addOverlay({ id: 'handles', space: 'canvas', interactive: true, mount: (element) => {
      element.append(Object.assign(document.createElement('button'), { textContent: 'handle' }))
    } })
    api.canvas.addFrameOverlay({ id: 'outline', mount: (element, context: FrameScopedContext) => {
      frameKeys.push(context.frame.key)
      element.textContent = context.frame.target.variantId
    } })
  })
  const registry = (test.viewport.vm as unknown as { registry: CanvasFrames }).registry
  // Frame documents render where camera and registry place them, plus any external layout shift.
  const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
  const viewportGeometry = spy.getMockImplementation()!
  spy.mockImplementation(function (this: HTMLElement) {
    const entry = [...registry.frames.values()].find(frame => frame.iframe === this)
    if (!entry) return viewportGeometry.call(this)
    const { effectiveZoom: zoom, panOffset: pan } = test.canvas
    const [left, top] = [pan.x + entry.rect.x * zoom + shift.x, pan.y + entry.rect.y * zoom + shift.y]
    return { x: left, y: top, left, top, right: left + entry.rect.width * zoom, bottom: top + entry.rect.height * zoom, width: entry.rect.width * zoom, height: entry.rect.height * zoom, toJSON: () => ({}) }
  })
  /** Frame overlay boxes by frame key, in viewport pixels. */
  function boxes() {
    return Object.fromEntries([...test.viewport.element.querySelectorAll<HTMLElement>('[data-frame-key]')].map(box => [box.dataset.frameKey, [box.style.left, box.style.top, box.style.width, box.style.height].map(Number.parseFloat)]))
  }
  /** Expected box of one registered frame under the current camera. */
  function expected(key: string) {
    const entry = registry.getFrame(key)!
    const { effectiveZoom: zoom, panOffset: pan } = test.canvas
    return [pan.x + entry.rect.x * zoom + shift.x, pan.y + entry.rect.y * zoom + shift.y, entry.rect.width * zoom, entry.rect.height * zoom]
  }
  // Geometry above replaced the fixture's zero-sized frames: lay out again.
  window.dispatchEvent(new Event('resize'))
  await flushPromises()
  return { ...test, registry, frameKeys, boxes, expected, plugin, context: () => canvasContext! }
}

/** The plugin element rendered by contribution `id`. */
function contribution(root: Element, id: string): Element {
  return root.querySelector(`[data-histoire-contribution="${id}"]`)!
}

describe('plugin canvas overlays', () => {
  afterEach(() => {
    shift.x = 0
    shift.y = 0
  })

  it('follows each frame document box through pan, zoom, layout, rotation, resize and scroll', async () => {
    const test = await overlayFixture()
    const key = JSON.stringify(['a:b', 'c'])
    expect(test.boxes()[key]).toEqual(test.expected(key))
    test.canvas.setPanOffset({ x: 140, y: -20 })
    test.canvas.setZoom(0.8)
    await flushPromises()
    expect(test.boxes()[key]).toEqual(test.expected(key))
    await test.canonical.settings.update({ rotate: true })
    await flushPromises()
    expect(test.boxes()[key]).toEqual(test.expected(key))
    shift.x = 30
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(test.boxes()[key]).toEqual(test.expected(key))
    shift.y = 12
    document.body.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(test.boxes()[key]).toEqual(test.expected(key))
  })

  it('gives two frames of the same variant distinct frame keys and overlay instances', async () => {
    const test = await overlayFixture()
    const container = test.viewport.element.appendChild(document.createElement('div'))
    const lease = await test.context().canvas.acquireFrame({ storyId: 'a:b', variantId: 'c' }, { container, rect: { x: 900, y: 0, width: 300, height: 200 } })
    await lease.ready
    await flushPromises()
    const grid = JSON.stringify(['a:b', 'c'])
    expect(lease.frame.key).not.toBe(grid)
    expect(Object.keys(test.boxes())).toEqual(expect.arrayContaining([grid, lease.frame.key]))
    expect(test.frameKeys.filter(key => key === grid)).toHaveLength(1)
    expect(test.frameKeys.filter(key => key === lease.frame.key)).toHaveLength(1)
    lease.release()
    await flushPromises()
    expect(Object.keys(test.boxes())).not.toContain(lease.frame.key)
  })

  it('keeps passive overlays out of pointer input and lets interactive ones receive it', async () => {
    const test = await overlayFixture()
    const root = test.viewport.element
    expect(contribution(root, 'acme:hud').closest('[inert]')).not.toBeNull()
    expect(contribution(root, 'acme:outline').closest('[inert]')).not.toBeNull()
    expect(contribution(root, 'acme:handles').closest('[inert]')).toBeNull()
  })

  it('exposes live readonly canvas geometry through the canvas-scoped context', async () => {
    const test = await overlayFixture()
    const context = test.context()
    expect(context.capabilities.has('canvas')).toBe(true)
    const changed = vi.fn()
    context.canvas.subscribe(changed)
    test.canvas.setPanOffset({ x: 50, y: 60 })
    test.canvas.setZoom(2)
    await flushPromises()
    expect(changed).toHaveBeenCalled()
    expect(context.canvas.zoom).toBe(test.canvas.effectiveZoom)
    expect(context.canvas.toViewport({ x: 0, y: 0 })).toEqual(test.canvas.panOffset)
    expect(context.canvas.toCanvas(context.canvas.toViewport({ x: 7, y: 9 }))).toEqual({ x: 7, y: 9 })
    expect(context.canvas.frames().map(frame => frame.frame.key)).toContain(JSON.stringify(['a:b', 'c']))
    expect(Object.isFrozen(context.canvas)).toBe(true)
  })

  it('exposes canvas frames, leased ones included, to plugin channels by canvas frame id', async () => {
    const test = await overlayFixture()
    const container = test.viewport.element.appendChild(document.createElement('div'))
    const lease = await test.context().canvas.acquireFrame({ storyId: 'a:b', variantId: 'c' }, { container })
    await lease.ready
    // Each frame document announces its attached actor, as the frame runtime does.
    for (const frame of test.registry.frames.values()) {
      if (!frame.iframe || !frame.documentId) continue
      const data = { __histoire: true, type: HOST_CHANNEL_MESSAGE, documentId: frame.documentId, storyId: frame.storyId, variantId: frame.variantId, plugin: { pluginId: 'acme', actorId: `${frame.id}-actor`, type: 'histoire:attached', data: null } }
      window.dispatchEvent(new MessageEvent('message', { source: frame.iframe.contentWindow, origin: window.location.origin, data }))
    }
    expect(test.plugin.frames.list().map(frame => frame.key)).toEqual(expect.arrayContaining([JSON.stringify(['a:b', 'c']), lease.frame.key]))
  })
})
