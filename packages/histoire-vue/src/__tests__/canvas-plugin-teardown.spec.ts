import type { CanvasFrames } from '../../../histoire-app/src/app/composables/canvas-settings.js'
import type { CanvasScopedContext, ViewMount } from '../../../histoire-plugin-kit/src/index.js'
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

/** Live DOM views per contribution: incremented on mount, decremented on dispose. */
const live = new Map<string, number>()
/** Most live views of one contribution ever seen at once. */
const peak = new Map<string, number>()

/**
 * DOM mount recording its own lifetime.
 * @param id Contribution id used as counter key.
 * @param onMount Extra work done while mounting.
 */
function counted(id: string, onMount?: (element: HTMLElement, context: any) => void): ViewMount<any> {
  return (element, context) => {
    live.set(id, (live.get(id) ?? 0) + 1)
    peak.set(id, Math.max(peak.get(id) ?? 0, live.get(id)!))
    onMount?.(element, context)
    return { dispose: () => void live.set(id, live.get(id)! - 1) }
  }
}

/** Net `addEventListener` minus `removeEventListener` calls on `window`, per event type. */
function trackWindowListeners() {
  const net = new Map<string, number>()
  const add = window.addEventListener.bind(window)
  const remove = window.removeEventListener.bind(window)
  vi.spyOn(window, 'addEventListener').mockImplementation((type: string, ...rest: any[]) => {
    net.set(type, (net.get(type) ?? 0) + 1)
    return (add as any)(type, ...rest)
  })
  vi.spyOn(window, 'removeEventListener').mockImplementation((type: string, ...rest: any[]) => {
    net.set(type, (net.get(type) ?? 0) - 1)
    return (remove as any)(type, ...rest)
  })
  return net
}

describe('plugin teardown under repeated toggling', () => {
  it('leaves no views, overlays, leases, subscriptions or listeners behind', async () => {
    live.clear()
    peak.clear()
    const net = trackWindowListeners()
    let pluginSignal!: AbortSignal
    const setupDisposed = vi.fn()
    const test = await canvasPluginFixture(replica.create, (api) => {
      pluginSignal = api.signal
      api.canvas.addOverlay({ id: 'hud', space: 'viewport', mount: counted('hud') })
      api.canvas.addFrameOverlay({ id: 'outline', mount: counted('outline') })
      api.canvas.addView({ id: 'compare', label: 'Compare', icon: 'compare', mount: counted('compare', (element, context: CanvasScopedContext) => {
        const container = element.appendChild(document.createElement('div'))
        context.canvas.acquireFrame({ storyId: 'a:b', variantId: 'other' }, { container, queue: true }).catch(() => {})
      }) })
      api.context.subscribe(() => {})
      api.frames.subscribe(() => {})
      return setupDisposed
    })
    const registry = (test.viewport.vm as unknown as { registry: CanvasFrames }).registry

    for (let round = 0; round < 4; round++) {
      test.arrange.value = 'acme:compare'
      await flushPromises()
      expect(live.get('compare')).toBe(1)
      await test.canonical.selection.select({ storyId: 'a:b', variantId: round % 2 ? 'c' : 'other' })
      test.uiHidden.value = true
      await flushPromises()
      expect(live.get('hud')).toBe(0)
      test.uiHidden.value = false
      test.arrange.value = round % 2 ? 'grid' : 'matrix'
      await flushPromises()
      expect(live.get('compare')).toBe(0)
      expect([...registry.frames.keys()].filter(key => key.startsWith('lease:'))).toEqual([])
    }
    // Toggling never stacked duplicate views of one contribution.
    expect(peak.get('hud')).toBe(1)
    expect(peak.get('compare')).toBe(1)

    test.wrapper.unmount()
    await test.workbench.dispose()
    await flushPromises()
    expect([...live].filter(([, count]) => count !== 0)).toEqual([])
    expect(document.querySelectorAll('[data-histoire-contribution]')).toHaveLength(0)
    expect(pluginSignal.aborted).toBe(true)
    expect(setupDisposed).toHaveBeenCalledOnce()
    expect(test.workbench.host.contributions('canvas.overlay')).toEqual([])
    // Frame channel, shortcut and geometry listeners added while mounted were all removed.
    expect([...net].filter(([, count]) => count > 0)).toEqual([])
  })
})
