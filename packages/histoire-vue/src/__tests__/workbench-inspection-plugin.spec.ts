import { createHistoireSessionWithAdapters } from '@histoire/sdk/internal'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, onTestFinished } from 'vitest'
import { shallowRef } from 'vue'
import { inspectionPluginEntries } from '../../../histoire-app/src/app/components/inspector/inspection/plugin.js'
import { createCanvasFrames } from '../../../histoire-app/src/app/composables/canvas-settings.js'
import { createCanvasScopedContext, createCanvasService } from '../../../histoire-app/src/app/extensions/canvas-service.js'
import { createCanvasStore } from '../../../histoire-app/src/app/stores/canvas.js'
import { deferred, sourceFixture } from '../../../histoire-sdk/src/__tests__/fixtures/session.js'
import { createTestWorkbenchHost } from '../../../histoire/src/node/__tests__/utils/workbench-extensions.js'

/** Real connected session with optional admitted actor. */
async function sourceSession(available: boolean, mountActor: boolean) {
  const source = sourceFixture()
  source.descriptor.inspection = { variant: { available } }
  const session = createHistoireSessionWithAdapters({ url: 'https://book.example/' }, source.adapters)
  onTestFinished(() => session.dispose())
  await session.connect()
  await session.selection.select({ storyId: 'a:b', variantId: 'c' })
  if (mountActor) await session.mount(document.createElement('div'), { surface: 'preview' }).ready
  return { source, session }
}

/** Actual extension host observes distinct canonical source and selected actor sessions. */
async function fixture(enabled: boolean, actorAvailable: boolean) {
  const root = await sourceSession(true, false)
  const actor = await sourceSession(actorAvailable, true)
  const current = shallowRef(root.session)
  const entries = inspectionPluginEntries([], enabled, root.session, current, () => {})
  const { workbench } = createTestWorkbenchHost({ session: root.session, plugins: entries })
  onTestFinished(() => workbench.dispose())
  await workbench.host.ready
  const ids = () => workbench.host.contributions('inspector.tab').map(item => item.id)
  return { root, actor, current, workbench, ids }
}

describe('opt-in workbench inspection registration', () => {
  it('retains a source-granted placeholder while loading, then requires a granted current actor', async () => {
    const disabled = await fixture(false, true)
    expect(disabled.ids()).toEqual([])
    const enabled = await fixture(true, false)
    expect(enabled.ids()).toEqual(['histoire-inspection:state'])
    enabled.current.value = enabled.actor.session
    expect(enabled.ids()).toEqual([])
    enabled.actor.source.descriptor.inspection = { variant: { available: true } }
    enabled.actor.source.emitCatalog()
    enabled.actor.source.ready()
    expect(enabled.ids()).toEqual(['histoire-inspection:state'])
    enabled.root.source.descriptor.inspection = { variant: { available: false } }
    enabled.root.source.emitCatalog()
    expect(enabled.ids()).toEqual([])
    enabled.root.source.descriptor.inspection = { variant: { available: true } }
    enabled.root.source.emitCatalog()
    expect(enabled.ids()).toEqual(['histoire-inspection:state'])
    enabled.root.source.emitDisconnect()
    expect(enabled.ids()).toEqual([])
    await enabled.root.session.connect()
    expect(enabled.ids()).toEqual(['histoire-inspection:state'])
    await enabled.workbench.dispose()
    enabled.root.source.emitCatalog()
    expect(enabled.ids()).toEqual([])
  })

  it('does not re-register from a retired actor after switching to a denied actor', async () => {
    const { actor, current, ids } = await fixture(true, true)
    current.value = actor.session
    expect(ids()).toEqual(['histoire-inspection:state'])
    const denied = await sourceSession(false, true)
    current.value = denied.session
    expect(ids()).toEqual([])
    actor.source.emitCatalog()
    actor.source.ready()
    expect(ids()).toEqual([])
  })

  it('rejects an actor from an older source revision until it updates', async () => {
    const { root, actor, current, ids } = await fixture(true, true)
    current.value = actor.session
    expect(ids()).toEqual(['histoire-inspection:state'])
    root.source.descriptor.revision = 'revision-2'
    root.source.emitCatalog()
    expect(ids()).toEqual([])
    actor.source.ready()
    expect(ids()).toEqual([])
    actor.source.descriptor.revision = 'revision-2'
    actor.source.emitCatalog()
    actor.source.ready()
    expect(ids()).toEqual(['histoire-inspection:state'])
  })

  it('offers the panel when DOM inspection alone is available', async () => {
    const { root, actor, current, ids } = await fixture(true, true)
    root.source.descriptor.inspection = { variant: { available: false }, dom: { available: true } }
    root.source.emitCatalog()
    actor.source.descriptor.inspection = { variant: { available: false }, dom: { available: true } }
    actor.source.emitCatalog()
    actor.source.ready()
    current.value = actor.session
    expect(ids()).toEqual(['histoire-inspection:state'])
  })

  it('offers components only when source and current actor both grant them', async () => {
    const { root, actor, current, ids } = await fixture(true, false)
    root.source.descriptor.inspection = { components: { available: true } }
    root.source.emitCatalog()
    current.value = actor.session
    expect(ids()).toEqual([])
    actor.source.descriptor.inspection = { components: { available: true } }
    actor.source.emitCatalog()
    actor.source.ready()
    expect(ids()).toEqual(['histoire-inspection:state'])
  })

  it('offers audit only when source and selected actor both grant it', async () => {
    const { root, actor, current, ids } = await fixture(true, false)
    root.source.descriptor.inspection = { accessibilityAudit: { available: true } }
    root.source.emitCatalog()
    current.value = actor.session
    expect(ids()).toEqual([])
    actor.source.descriptor.inspection = { accessibilityAudit: { available: true } }
    actor.source.emitCatalog()
    actor.source.ready()
    expect(ids()).toEqual(['histoire-inspection:state'])
  })

  it('picks only the selected admitted frame at document coordinates', async () => {
    const root = await sourceSession(true, false)
    const actor = await sourceSession(true, true)
    root.source.descriptor.inspection = { variant: { available: true }, pick: { available: true } }
    actor.source.descriptor.inspection = { variant: { available: true }, pick: { available: true } }
    root.source.emitCatalog()
    actor.source.emitCatalog()
    actor.source.ready()
    const original = actor.source.request.getMockImplementation()!
    let held: ReturnType<typeof deferred<unknown>> | undefined
    actor.source.request.mockImplementation((command, payload) => {
      if (command === 'inspection.pick') {
        const snapshot = actor.session.getSnapshot()
        if (held) return held.promise
        return Promise.resolve({ owner: { sourceId: snapshot.source!.sourceId, epoch: snapshot.source!.epoch, revision: snapshot.source!.revision, runtimeId: snapshot.runtime.runtimeId, target: { storyId: 'a:b', variantId: 'c' } }, observedAt: '2026-01-01T00:00:00Z', matched: true, selector: 'button' })
      }
      return original(command, payload)
    })
    const current = shallowRef(actor.session)
    let selected: ReturnType<typeof createTestWorkbenchHost>['workbench']['selectedFrame'] | undefined
    const entries = inspectionPluginEntries([], true, root.session, current, () => {}, () => selected?.current() ?? null)
    const { workbench, targets } = createTestWorkbenchHost({ session: root.session, plugins: entries })
    selected = workbench.selectedFrame
    selected.publish(actor.session, 'selected')
    onTestFinished(() => workbench.dispose())
    await workbench.host.ready
    const canvas = createCanvasStore()
    const frames = createCanvasFrames(canvas)
    const viewport = document.createElement('div')
    const iframe = document.createElement('iframe')
    viewport.getBoundingClientRect = () => ({ left: 40, top: 100, width: 900, height: 600 }) as DOMRect
    iframe.getBoundingClientRect = () => ({ left: 100, top: 200, width: 200, height: 120 }) as DOMRect
    frames.registerFrame({ id: 'selected', storyId: 'a:b', variantId: 'c', rect: { x: 0, y: 0, width: 1000, height: 600 }, iframe })
    const handle = createCanvasService({ canvas, frames, viewport: () => viewport, acquireFrame: async () => {
      throw new Error('Unexpected lease')
    } })
    const scoped = createCanvasScopedContext(workbench.context, handle.service)
    onTestFinished(() => {
      scoped.dispose()
      handle.dispose()
    })
    const tool = workbench.host.contributions('canvas.tool')[0]
    expect(tool?.label).toBe('Pick element')
    const event = { event: {} as PointerEvent, viewport: { x: 110, y: 130 }, canvas: { x: 0, y: 0 }, frame: { key: 'selected', target: { storyId: 'a:b', variantId: 'c' } } }
    tool.onPointerUp!(event, scoped.context)
    await flushPromises()
    expect(actor.source.request.mock.calls.find(([command]) => command === 'inspection.pick')?.[1]).toMatchObject({ x: 250, y: 150, target: { storyId: 'a:b', variantId: 'c' } })
    expect(root.session.getSnapshot().selection).toEqual({ storyId: 'a:b', variantId: 'c' })
    expect(targets.inspectorTab).toHaveBeenCalledTimes(1)
    const count = actor.source.request.mock.calls.filter(([command]) => command === 'inspection.pick').length
    const { viewportToFrame: _missing, ...legacyCanvas } = scoped.context.canvas
    expect(workbench.host.available('canvas.tool', scoped.context)).toHaveLength(1)
    expect(workbench.host.available('canvas.tool', { ...scoped.context, canvas: legacyCanvas })).toHaveLength(0)
    tool.onPointerUp!(event, { ...scoped.context, canvas: legacyCanvas })
    await flushPromises()
    expect(actor.source.request.mock.calls.filter(([command]) => command === 'inspection.pick')).toHaveLength(count)
    expect(root.session.getSnapshot().selection).toEqual({ storyId: 'a:b', variantId: 'c' })
    tool.onPointerUp!({ ...event, frame: { key: 'other', target: { storyId: 'a:b', variantId: 'other' } } }, scoped.context)
    await flushPromises()
    expect(actor.source.request.mock.calls.filter(([command]) => command === 'inspection.pick')).toHaveLength(count)
    held = deferred<unknown>()
    tool.onPointerUp!(event, scoped.context)
    await flushPromises()
    const owner = actor.session.getSnapshot()
    current.value = root.session
    selected.publish(undefined)
    held.resolve({ owner: { sourceId: owner.source!.sourceId, epoch: owner.source!.epoch, revision: owner.source!.revision, runtimeId: owner.runtime.runtimeId, target: { storyId: 'a:b', variantId: 'c' } }, observedAt: '2026-01-01T00:00:00Z', matched: true, selector: 'late' })
    await flushPromises()
    expect(targets.inspectorTab).toHaveBeenCalledTimes(1)
    current.value = actor.session
    selected.publish(actor.session, 'selected')
    const afterHeld = actor.source.request.mock.calls.filter(([command]) => command === 'inspection.pick').length
    root.source.descriptor.inspection = { variant: { available: true }, pick: { available: false } }
    root.source.emitCatalog()
    tool.onPointerUp!(event, scoped.context)
    await flushPromises()
    expect(actor.source.request.mock.calls.filter(([command]) => command === 'inspection.pick')).toHaveLength(afterHeld)
  })

  it('leaves a colliding caller plugin untouched and refuses internal registration', async () => {
    const { session } = await sourceSession(true, false)
    const plugin = { id: 'histoire-inspection', apiVersion: 1, options: undefined, load: async () => ({ default: {} }) }
    const messages: string[] = []
    const entries = inspectionPluginEntries([plugin], true, session, shallowRef(session), message => messages.push(message))
    expect(entries).toEqual([plugin])
    expect(entries[0]).toBe(plugin)
    expect(messages).toHaveLength(1)
  })
})
