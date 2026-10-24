import type { FrameScopedContext, WorkbenchContext, WorkbenchPluginApi } from '../../../../histoire-plugin-kit/src/index.js'
import { describe, expect, it } from 'vitest'
import { deferred } from './utils/mcp/deferred.js'
import { createSnapshotSession, createTestWorkbenchHost, pluginEntry } from './utils/workbench-extensions.js'

/** What an action observed through its captured context. */
interface Observation {
  frame?: string
  state?: unknown
  aborted: boolean
}

/**
 * Plugin registering one frame-menu action and one command; both await `gate` when given.
 * @param seen Receives one observation per settled action.
 * @param gate Pending completion; the action throws after it when `fail` is set.
 * @param fail Whether the action rejects after the gate.
 */
function actionPlugin(seen: Observation[], gate?: Promise<void>, fail = false) {
  /** Records the captured scope, optionally after waiting for the gate. */
  async function run(context: WorkbenchContext | FrameScopedContext, { signal }: { signal: AbortSignal }) {
    await gate
    const frame = 'frame' in context ? context : undefined
    seen.push({ frame: frame?.frame.key, state: frame?.runtime.getSnapshot().state?.value, aborted: signal.aborted })
    if (fail) throw new Error('late failure')
  }
  return pluginEntry({ id: 'acme', apiVersion: 1, setup(api: WorkbenchPluginApi) {
    api.menus.addFrameAction({ id: 'inspect', label: 'Inspect', icon: 'view', run })
    api.commands.add({ id: 'sync', label: 'Sync', icon: 'renew', run })
  } })
}

describe('workbench extension scopes', () => {
  it('binds selected-frame actions to the selected frame session, never the root or a previous frame', async () => {
    const seen: Observation[] = []
    const root = createSnapshotSession({ storyId: 'a:b', variantId: 'other' })
    const { workbench } = createTestWorkbenchHost({ session: root, plugins: [actionPlugin(seen)] })
    await workbench.host.ready
    const previous = createSnapshotSession({ storyId: 'a:b', variantId: 'other' }, { count: 2 })
    workbench.selectedFrame.publish(previous)
    const previousScope = workbench.selectedFrame.current()!

    root.select({ storyId: 'a:b', variantId: 'c' })
    const selected = createSnapshotSession({ storyId: 'a:b', variantId: 'c' }, { count: 1 })
    workbench.selectedFrame.publish(selected)
    const scope = workbench.selectedFrame.current()!
    const updates: unknown[] = []
    scope.context.runtime.subscribe(snapshot => updates.push(snapshot.state?.value))
    await workbench.run('acme:inspect', scope)
    previous.publish({ state: { target: { storyId: 'a:b', variantId: 'other' }, runtimeId: 'runtime', value: { count: 3 } } })
    root.publish({ state: { target: { storyId: 'a:b', variantId: 'c' }, runtimeId: 'root', value: { count: 4 } } })
    selected.publish({ state: { target: { storyId: 'a:b', variantId: 'c' }, runtimeId: 'runtime', value: { count: 5 } } })

    expect(previousScope.signal.aborted).toBe(true)
    expect(seen).toEqual([{ frame: '["a:b","c"]', state: { count: 1 }, aborted: false }])
    expect(updates).toEqual([{ count: 5 }])
    await workbench.dispose()
    expect(selected.listenerCount).toBe(0)
    expect(root.listenerCount).toBe(0)
  })

  it('keeps the right-clicked frame target after selection moves elsewhere', async () => {
    const seen: Observation[] = []
    const gate = deferred()
    const { workbench, session } = createTestWorkbenchHost({ plugins: [actionPlugin(seen, gate.promise)] })
    await workbench.host.ready
    const clicked = createSnapshotSession({ storyId: 'a:b', variantId: 'other' }, { count: 7 })
    const scope = workbench.frameScope({ key: 'grid-cell-2', target: { storyId: 'a:b', variantId: 'other' } }, clicked)

    const pending = workbench.run('acme:inspect', scope)
    session.select({ storyId: 'a', variantId: 'b:c' })
    workbench.selectedFrame.publish(createSnapshotSession({ storyId: 'a', variantId: 'b:c' }, { count: 0 }))
    gate.resolve()
    await pending

    expect(seen).toEqual([{ frame: 'grid-cell-2', state: { count: 7 }, aborted: false }])
    expect(scope.context.frame.target).toEqual({ storyId: 'a:b', variantId: 'other' })
  })

  it('aborts a pending selected-frame action on selection change and discards its late failure', async () => {
    const seen: Observation[] = []
    const gate = deferred()
    const { workbench, session } = createTestWorkbenchHost({ plugins: [actionPlugin(seen, gate.promise, true)] })
    await workbench.host.ready
    workbench.selectedFrame.publish(createSnapshotSession({ storyId: 'a:b', variantId: 'c' }, { count: 1 }))

    const pending = workbench.run('acme:inspect', workbench.selectedFrame.current()!)
    session.select({ storyId: 'a:b', variantId: 'other' })
    gate.resolve()

    await expect(pending).resolves.toBeUndefined()
    expect(seen).toEqual([expect.objectContaining({ aborted: true })])
    expect(workbench.host.diagnostics()).toEqual([])
  })

  it('aborts a pending root action on source change but not on unrelated publications', async () => {
    const seen: Observation[] = []
    const gate = deferred()
    const { workbench, session } = createTestWorkbenchHost({ plugins: [actionPlugin(seen, gate.promise, true)] })
    await workbench.host.ready

    const pending = workbench.run('acme:sync')
    session.publish({ events: { items: [], droppedCount: 1 } })
    expect(seen).toEqual([])
    session.restartSource()
    gate.resolve()

    await expect(pending).resolves.toBeUndefined()
    expect(seen).toEqual([{ aborted: true }])
    expect(workbench.host.diagnostics()).toEqual([])
  })
})
