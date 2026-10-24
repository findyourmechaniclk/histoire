import type { HistoireSession } from '@histoire/sdk'
import { createHistoireSessionWithAdapters } from '@histoire/sdk/internal'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { acquireStoryFrame } from '../../../histoire-app/src/app/components/canvas/frames/acquire-story-frame.js'
import { createCanvasFrames } from '../../../histoire-app/src/app/composables/canvas-settings.js'
import { createCanvasStore } from '../../../histoire-app/src/app/stores/canvas.js'
import { createMatrixStore } from '../../../histoire-app/src/app/stores/matrix.js'
import { deferred, sourceFixture } from '../../../histoire-sdk/src/__tests__/fixtures/session.js'
import { canvasRuntimeFixture } from './fixtures/canvas-runtime.js'
import { canvasStartupCoordinatorFixture } from './fixtures/canvas-startup-coordinator.js'

const replica = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('../../../histoire-app/src/app/components/canvas/frame-replica.js', () => ({ createCanvasReplicaSession: replica.create }))
afterEach(() => {
  replica.create.mockReset()
  document.body.innerHTML = ''
})

const target = { storyId: 'a:b', variantId: 'c' }

/** Acquire one managed frame outside any component, as a plugin lease will. */
async function leaseFixture(options: { startup?: ReturnType<typeof canvasStartupCoordinatorFixture>, prepare?: (session: HistoireSession) => void } = {}) {
  const source = sourceFixture()
  const canonical = createHistoireSessionWithAdapters({ url: 'https://book.example/' }, source.adapters)
  await canonical.connect()
  await canonical.selection.select(target)
  const children: HistoireSession[] = []
  replica.create.mockImplementation(() => {
    const child = canvasRuntimeFixture().session
    options.prepare?.(child)
    children.push(child)
    return child
  })
  const frames = createCanvasFrames(createCanvasStore())
  frames.registerFrame({ id: 'frame', ...target, rect: { x: 0, y: 0, width: 100, height: 100 } })
  const container = document.body.appendChild(document.createElement('div'))
  const statuses: string[] = []
  const matrix = createMatrixStore()
  const frame = acquireStoryFrame({
    canonical,
    frames,
    matrix,
    startup: options.startup,
    frameId: () => 'frame',
    target: () => target,
    previewBase: () => 'https://book.example/',
    container: () => container,
    settings: () => canonical.getSnapshot().settings,
    arrangement: () => 'grid',
    root: () => null,
    onStatus: status => statuses.push(status),
  })
  onTestFinished(async () => {
    frame.release()
    matrix.close()
    await canonical.dispose()
  })
  return { frame, frames, container, children, statuses }
}

describe('managed story frame acquisition', () => {
  it('releases a ready frame by disposing its session and retiring its registered document', async () => {
    const test = await leaseFixture()
    await test.frame.start()
    await flushPromises()
    expect(test.frame.status.value).toBe('ready')
    expect(test.frames.getFrame('frame')?.session).toBe(test.children[0])
    test.frame.release()
    await flushPromises()
    expect(test.children).toHaveLength(1)
    expect(test.children[0].getSnapshot().status).toBe('disposed')
    expect(test.frames.getFrame('frame')?.session).toBeUndefined()
    expect(test.container.querySelector('iframe')).toBeNull()
  })

  it('cancels a queued startup on release without ever creating a session', async () => {
    // An empty startup order keeps the request queued behind the coordinator.
    const startup = canvasStartupCoordinatorFixture()
    const test = await leaseFixture({ startup })
    const started = test.frame.start()
    await flushPromises()
    test.frame.release()
    await started
    expect(replica.create).not.toHaveBeenCalled()
    expect(test.statuses).not.toContain('ready')
  })

  it('cancels startup released during connection and disposes the half-acquired session', async () => {
    const connection = deferred<void>()
    const test = await leaseFixture({
      prepare(session) {
        const connect = session.connect.bind(session)
        session.connect = () => connection.promise.then(connect)
      },
    })
    const started = test.frame.start()
    await flushPromises()
    expect(test.children).toHaveLength(1)
    test.frame.release()
    connection.resolve()
    await started
    await flushPromises()
    expect(test.children[0].getSnapshot().status).toBe('disposed')
    expect(test.statuses).not.toContain('ready')
    expect(test.container.querySelector('iframe')).toBeNull()
  })
})
