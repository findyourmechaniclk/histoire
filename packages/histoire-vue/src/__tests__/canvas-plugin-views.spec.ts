import type { HistoireTarget } from '@histoire/protocol'
import type { CanvasFrames } from '../../../histoire-app/src/app/composables/canvas-settings.js'
import type { CanvasViewContext, CanvasViewInput, FrameLease, FrameLeaseError } from '../../../histoire-plugin-kit/src/index.js'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CanvasFrame from '../../../histoire-app/src/app/components/canvas/CanvasFrame.vue'
import { deferred } from '../../../histoire/src/node/__tests__/utils/mcp/deferred.js'
import { canvasPluginFixture } from './fixtures/canvas-plugins.js'

const replica = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('../../../histoire-app/src/app/components/canvas/frame-replica.js', () => ({ createCanvasReplicaSession: replica.create }))
afterEach(() => {
  replica.create.mockReset()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

const selected = { storyId: 'a:b', variantId: 'c' }
const other = { storyId: 'a:b', variantId: 'other' }

/** What a comparison view saw while mounted. */
interface ViewRecord {
  /** Granted leases, in grant order. */
  leases: FrameLease[]
  /** Lease failures (budget, released, unavailable). */
  errors: FrameLeaseError[]
  /** Contexts handed to each mount. */
  contexts: CanvasViewContext[]
}

/**
 * Comparison view leasing `targets` side by side. It never releases anything itself, so every
 * release the tests observe comes from the canvas.
 * @param targets Variants to lease, one frame each.
 * @param extra Descriptor fields merged over the defaults.
 */
function compareView(targets: HistoireTarget[], extra: Partial<CanvasViewInput> = {}) {
  const record: ViewRecord = { leases: [], errors: [], contexts: [] }
  const view = { id: 'compare', label: 'Compare', icon: 'compare', ...extra, mount(element: HTMLElement, context: CanvasViewContext) {
    record.contexts.push(context)
    targets.forEach((target, index) => {
      const container = element.appendChild(document.createElement('div'))
      context.canvas.acquireFrame(target, { container, rect: { x: index * 400, y: 0, width: 360, height: 240 }, queue: true })
        .then(lease => void record.leases.push(lease), error => void record.errors.push(error))
    })
  } } as CanvasViewInput
  return { view, record }
}

/**
 * Canvas with the `acme:compare` view registered, tracking live frame documents (created and
 * not yet disposed sessions) and the most ever live at once.
 * @param view View descriptor.
 * @param options Fixture options (`budget`, `gate`).
 */
async function viewFixture(view: CanvasViewInput, options: Parameters<typeof canvasPluginFixture>[2] = {}) {
  let peak = 0
  const disposed = new WeakSet<object>()
  const test = await canvasPluginFixture(replica.create, api => api.canvas.addView(view), options)
  const live = () => test.children.filter(child => !disposed.has(child)).length
  /** Record disposal of one frame session. */
  function track(child: (typeof test.children)[number]): void {
    const dispose = child.session.dispose.bind(child.session)
    child.session.dispose = () => {
      disposed.add(child)
      return dispose()
    }
  }
  test.children.forEach(track)
  test.prepareChild.mockImplementation((child) => {
    track(child)
    peak = Math.max(peak, live() + 1)
  })
  const registry = (test.viewport.vm as unknown as { registry: CanvasFrames }).registry
  /** Switch arrangement and let frames start. */
  async function arrange(value: typeof test.arrange.value): Promise<void> {
    test.arrange.value = value
    await flushPromises()
  }
  return { ...test, registry, live, peak: () => peak, arrange }
}

describe('custom canvas views', () => {
  it('shows a loading state until plugins settle, then mounts the view with a canvas-scoped context', async () => {
    const gate = deferred()
    const { view, record } = compareView([])
    const test = await viewFixture(view, { gate: gate.promise })
    await test.arrange('acme:compare')
    expect(test.wrapper.find('[role="status"]').text()).toContain('Loading')
    expect(test.wrapper.findAllComponents(CanvasFrame)).toHaveLength(0)
    expect(record.contexts).toHaveLength(0)
    gate.resolve()
    await test.workbench.host.ready
    await flushPromises()
    expect(test.wrapper.find('[role="status"]').exists()).toBe(false)
    expect(record.contexts).toHaveLength(1)
    expect(record.contexts[0].capabilities.has('canvas')).toBe(true)
  })

  it('releases the previous view leases on every switch and keeps the story selection', async () => {
    const { view, record } = compareView([selected, other])
    const test = await viewFixture(view)
    for (let round = 0; round < 3; round++) {
      await test.arrange('acme:compare')
      await Promise.all(record.leases.map(lease => lease.ready))
      expect([...test.registry.frames.keys()].filter(key => key.startsWith('lease:'))).toHaveLength(2)
      await test.arrange(round % 2 ? 'list' : 'grid')
      expect([...test.registry.frames.keys()].filter(key => key.startsWith('lease:'))).toHaveLength(0)
      record.leases.length = 0
    }
    expect(record.errors).toEqual([])
    expect(test.canonical.getSnapshot().selection).toEqual(selected)
    expect(test.live()).toBeLessThanOrEqual(3)
  })

  it('lets a custom view lease the full frame budget', async () => {
    const { view, record } = compareView([selected, other, selected])
    const test = await viewFixture(view, { budget: 3 })
    await test.arrange('acme:compare')
    expect(record.leases).toHaveLength(3)
    await expect(record.contexts[0].canvas.acquireFrame(other, { container: document.createElement('div') })).rejects.toMatchObject({ reason: 'budget' })
  })

  it('publishes the selected leased frame session to the inspector under its lease key', async () => {
    const { view, record } = compareView([other, selected])
    const test = await viewFixture(view)
    await test.arrange('acme:compare')
    await Promise.all(record.leases.map(lease => lease.ready))
    await flushPromises()
    const lease = record.leases.find(candidate => candidate.frame.target.variantId === 'c')!
    const session = test.registry.getFrame(lease.frame.key)!.session
    expect(session).toBeDefined()
    expect(test.viewport.emitted('selectedSession')!.at(-1)).toEqual([session])
    test.workbench.selectedFrame.publish(session!)
    expect(test.workbench.selectedFrame.current()?.context.frame.key).toBe(lease.frame.key)
  })

  it('keeps the frame budget while switching repeatedly between Matrix and a custom view', async () => {
    const { view, record } = compareView([selected, other, selected, other])
    const test = await viewFixture(view, { budget: 3 })
    for (let round = 0; round < 3; round++) {
      await test.arrange('acme:compare')
      await test.arrange('matrix')
    }
    await test.arrange('acme:compare')
    expect(test.peak()).toBeLessThanOrEqual(3)
    expect(record.leases.filter(lease => test.registry.getFrame(lease.frame.key))).toHaveLength(3)
  })

  it('re-reads a changed layout when the view requests it, without remounting', async () => {
    let columns = 1
    const { view, record } = compareView([], { layout: () => Array.from({ length: columns }, (_, index) => ({ x: index * 400, y: 0, width: 360, height: 240 })) })
    const test = await viewFixture(view)
    await test.arrange('acme:compare')
    const initial = test.canvas.effectiveZoom
    columns = 12
    await flushPromises()
    expect(test.canvas.effectiveZoom).toBe(initial)
    record.contexts[0].canvas.requestLayout()
    await flushPromises()
    expect(test.canvas.effectiveZoom).toBeLessThan(initial)
    expect(record.contexts).toHaveLength(1)
  })

  it('shows the view failure with an action that switches back to Grid', async () => {
    const test = await viewFixture({ id: 'compare', label: 'Compare', icon: 'compare', mount: () => {
      throw new Error('boom')
    } })
    await test.arrange('acme:compare')
    const alert = test.wrapper.find('[role="alert"]')
    expect(alert.text()).toContain('Compare failed')
    await alert.find('button').trigger('click')
    expect(test.targets.canvasView).toHaveBeenCalledWith('grid')
  })
})
