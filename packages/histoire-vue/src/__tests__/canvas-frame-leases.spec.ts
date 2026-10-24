import type { FrameLeaseError } from '../../../histoire-plugin-kit/src/index.js'
import { createHistoireSessionWithAdapters } from '@histoire/sdk/internal'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, ref, watch } from 'vue'
import { createCanvasFrameLeases } from '../../../histoire-app/src/app/components/canvas/frames/frame-leases.js'
import { createCanvasFrameLedger } from '../../../histoire-app/src/app/components/canvas/frames/frame-ledger.js'
import { createCanvasFrames } from '../../../histoire-app/src/app/composables/canvas-settings.js'
import { createContextMenu } from '../../../histoire-app/src/app/composables/context-menu.js'
import { createCanvasStore } from '../../../histoire-app/src/app/stores/canvas.js'
import { sourceFixture } from '../../../histoire-sdk/src/__tests__/fixtures/session.js'
import { canvasRuntimeFixture } from './fixtures/canvas-runtime.js'
import { canvasStartupCoordinatorFixture } from './fixtures/canvas-startup-coordinator.js'

const replica = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('../../../histoire-app/src/app/components/canvas/frame-replica.js', () => ({ createCanvasReplicaSession: replica.create }))
afterEach(() => {
  replica.create.mockReset()
  document.body.innerHTML = ''
})

const target = { storyId: 'a:b', variantId: 'c' }

/** Lease manager over a real ledger and startup coordinator, ordered like CanvasViewport orders them. */
async function leasesFixture(total: number, selected: string[] = []) {
  const source = sourceFixture()
  const canonical = createHistoireSessionWithAdapters({ url: 'https://book.example/' }, source.adapters)
  await canonical.connect()
  const children: { dispose: ReturnType<typeof vi.spyOn> }[] = []
  replica.create.mockImplementation(() => {
    const child = canvasRuntimeFixture().session
    children.push({ dispose: vi.spyOn(child, 'dispose') })
    return child
  })
  const frames = createCanvasFrames(createCanvasStore())
  const budget = ref(total)
  const ledger = createCanvasFrameLedger(() => budget.value)
  const startup = canvasStartupCoordinatorFixture()
  const menu = createContextMenu()
  const scope = effectScope()
  const leases = scope.run(() => createCanvasFrameLeases({
    canonical,
    frames,
    ledger,
    startup: () => startup,
    previewBase: () => 'https://book.example/',
    settings: () => canonical.getSnapshot().settings,
    root: () => null,
    menu,
  }))!
  // CanvasViewport keeps visible frames (selected first) ahead of leases in the startup order.
  scope.run(() => watch(() => [...selected, ...leases.ids.value], order => startup.setOrder(order), { immediate: true, flush: 'sync' }))
  onTestFinished(async () => {
    leases.dispose()
    scope.stop()
    await canonical.dispose()
  })
  /** Fresh attached container, as a plugin view would provide. */
  const container = () => document.body.appendChild(document.createElement('div'))
  return { leases, frames, ledger, budget, startup, menu, children, container }
}

/** Await a rejection and return its lease error. */
async function rejection(promise: Promise<unknown>): Promise<FrameLeaseError> {
  return promise.then(() => Promise.reject(new Error('expected rejection')), error => error as FrameLeaseError)
}

describe('plugin frame leases', () => {
  it('registers each lease as its own frame, even for the same variant, and unregisters on release', async () => {
    const test = await leasesFixture(3)
    const first = await test.leases.acquire(target, { container: test.container() })
    const second = await test.leases.acquire(target, { container: test.container() })
    expect(first.frame.key).not.toBe(second.frame.key)
    expect(first.frame.target).toEqual(target)
    await Promise.all([first.ready, second.ready])
    expect(test.frames.getFrame(first.frame.key)?.session).toBeDefined()
    expect(test.frames.getFrame(second.frame.key)?.session).not.toBe(test.frames.getFrame(first.frame.key)?.session)
    first.release()
    expect(test.frames.getFrame(first.frame.key)).toBeNull()
    expect(test.frames.getFrame(second.frame.key)).not.toBeNull()
  })

  it('denies a lease when only the selected frame slot is left, and returns slots on release', async () => {
    const test = await leasesFixture(2)
    const lease = await test.leases.acquire(target, { container: test.container() })
    expect(test.ledger.available.value).toBe(1)
    const denied = await rejection(test.leases.acquire(target, { container: test.container() }))
    expect(denied.name).toBe('FrameLeaseError')
    expect(denied.reason).toBe('budget')
    lease.release()
    lease.release()
    expect(test.ledger.available.value).toBe(2)
  })

  it('queues a lease until a slot frees, and withdraws a queued request when its signal aborts', async () => {
    const test = await leasesFixture(2)
    const held = await test.leases.acquire(target, { container: test.container() })
    const controller = new AbortController()
    const withdrawn = test.leases.acquire(target, { container: test.container(), queue: true, signal: controller.signal })
    const queued = test.leases.acquire(target, { container: test.container(), queue: true })
    controller.abort()
    expect((await rejection(withdrawn)).reason).toBe('released')
    held.release()
    const granted = await queued
    await granted.ready
    expect(test.frames.getFrame(granted.frame.key)?.session).toBeDefined()
  })

  it('starts leased frames only after the selected frame is ready', async () => {
    const test = await leasesFixture(3, ['selected'])
    const lease = await test.leases.acquire(target, { container: test.container() })
    await flushPromises()
    expect(replica.create).not.toHaveBeenCalled()
    let finish!: () => void
    const anchor = test.startup.request('selected', () => new Promise<void>(resolve => finish = resolve))
    await flushPromises()
    expect(replica.create).not.toHaveBeenCalled()
    finish()
    await anchor.completion
    await lease.ready
    expect(replica.create).toHaveBeenCalledTimes(1)
  })

  it('disposes the leased session exactly once however often it is released', async () => {
    const test = await leasesFixture(3)
    const lease = await test.leases.acquire(target, { container: test.container() })
    await lease.ready
    lease.release()
    lease.release()
    await flushPromises()
    expect(test.children).toHaveLength(1)
    expect(test.children[0].dispose).toHaveBeenCalledTimes(1)
  })

  it('cancels startup on release and rejects readiness as released', async () => {
    const test = await leasesFixture(3, ['selected'])
    const lease = await test.leases.acquire(target, { container: test.container() })
    lease.release()
    expect((await rejection(lease.ready)).reason).toBe('released')
    await flushPromises()
    expect(replica.create).not.toHaveBeenCalled()
  })

  it('opens the frame menu for the leased frame from its container', async () => {
    const test = await leasesFixture(3)
    const container = test.container()
    const lease = await test.leases.acquire(target, { container })
    container.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 4, clientY: 8 }))
    expect(test.menu.state.target).toEqual({ ...target, frameKey: lease.frame.key })
  })
})
