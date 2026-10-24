// @vitest-environment jsdom
import type { ViewHandle, ViewHost, ViewMount, WorkbenchContext } from '../index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestHost, deferred, plugin } from './fixtures/host.js'

/** Context snapshots are opaque to the host; tests tag them. */
type Snapshot = WorkbenchContext & { tag: string }

/**
 * Host with one plugin registering a rail pane per given mount.
 * @param mounts DOM mounts keyed by local pane id.
 */
async function hostWithPanes(mounts: Record<string, ViewMount<Snapshot>>) {
  const host = createTestHost([plugin('acme', (api) => {
    for (const [id, mount] of Object.entries(mounts)) api.shell.addPane({ id, label: id, icon: 'plug', mount: mount as ViewMount<WorkbenchContext> })
  })])
  await host.ready
  return host
}

/**
 * Snapshot of the host test context with a tag.
 * @param host Host whose root context is copied.
 * @param host.context Root context.
 * @param tag Distinguishing value.
 */
function snapshot(host: { context: WorkbenchContext }, tag: string): Snapshot {
  return { ...host.context, tag }
}

/** Flushes promise reactions of async mounts. */
const settle = () => new Promise(resolve => setTimeout(resolve))

afterEach(() => {
  document.body.replaceChildren()
})

describe('extension host DOM mounts', () => {
  it('pushes context snapshots to the mounted view and disposes it with its scope', async () => {
    const update = vi.fn()
    const dispose = vi.fn()
    let viewHost!: ViewHost
    const mount = vi.fn((container: HTMLElement, context: Snapshot, host: ViewHost): ViewHandle<Snapshot> => {
      viewHost = host
      container.textContent = context.tag
      return { update, dispose }
    })
    const host = await hostWithPanes({ pane: mount })
    const container = document.createElement('div')
    const view = host.mount('acme:pane', container, snapshot(host, 'first'))
    await view.ready
    view.update(snapshot(host, 'second'))
    expect(mount).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ tag: 'second' }))
    expect(container.textContent).toBe('first')

    // Plugin retirement (here: host disposal) disposes the view and aborts its signal.
    await host.dispose()
    await settle()
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(viewHost.signal.aborted).toBe(true)
    await view.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('disposes a mount that completes after retirement and never updates it', async () => {
    const gate = deferred<ViewHandle<Snapshot>>()
    const handle = { update: vi.fn(), dispose: vi.fn() }
    let signal!: AbortSignal
    const host = await hostWithPanes({ pane: (_container, _context, viewHost) => {
      signal = viewHost.signal
      return gate.promise
    } })
    const view = host.mount('acme:pane', document.createElement('div'), snapshot(host, 'first'))
    view.update(snapshot(host, 'second'))
    const disposal = view.dispose()
    expect(signal.aborted).toBe(true)
    gate.resolve(handle)
    await disposal
    await settle()
    expect(handle.dispose).toHaveBeenCalledTimes(1)
    expect(handle.update).not.toHaveBeenCalled()
  })

  it('applies only the latest snapshot pushed while mounting, after the mount settles', async () => {
    const gate = deferred<ViewHandle<Snapshot>>()
    const update = vi.fn()
    const host = await hostWithPanes({ pane: () => gate.promise })
    const view = host.mount('acme:pane', document.createElement('div'), snapshot(host, 'first'))
    view.update(snapshot(host, 'second'))
    view.update(snapshot(host, 'third'))
    expect(update).not.toHaveBeenCalled()
    gate.resolve({ update })
    await view.ready
    expect(update.mock.calls.map(([context]) => context.tag)).toEqual(['third'])
  })

  it('keeps mount and update failures local to the failing view', async () => {
    const mountError = new Error('mount failed')
    const updateError = new Error('update failed')
    const disposeBroken = vi.fn()
    const sibling = { update: vi.fn(), dispose: vi.fn() }
    const host = await hostWithPanes({
      broken: () => {
        throw mountError
      },
      flaky: () => ({ update: () => {
        throw updateError
      }, dispose: disposeBroken }),
      sibling: () => sibling,
    })
    const onError = vi.fn()
    const broken = host.mount('acme:broken', document.createElement('div'), snapshot(host, 'a'), { onError })
    const flaky = host.mount('acme:flaky', document.createElement('div'), snapshot(host, 'a'), { onError })
    const healthy = host.mount('acme:sibling', document.createElement('div'), snapshot(host, 'a'))
    await expect(broken.ready).rejects.toBe(mountError)
    await flaky.ready
    await healthy.ready
    flaky.update(snapshot(host, 'b'))
    flaky.update(snapshot(host, 'c'))
    healthy.update(snapshot(host, 'b'))
    await settle()

    expect(onError.mock.calls).toEqual([[mountError, 'mount'], [updateError, 'update']])
    // A failed update leaves the view in an unknown state: it is disposed, later snapshots dropped.
    expect(disposeBroken).toHaveBeenCalledTimes(1)
    expect(sibling.update).toHaveBeenCalledWith(expect.objectContaining({ tag: 'b' }))
    expect(sibling.dispose).not.toHaveBeenCalled()
    expect(host.diagnostics().map(({ pluginId, contributionId, phase, error }) => ({ pluginId, contributionId, phase, error }))).toEqual([
      { pluginId: 'acme', contributionId: 'acme:broken', phase: 'mount', error: mountError },
      { pluginId: 'acme', contributionId: 'acme:flaky', phase: 'update', error: updateError },
    ])
  })

  it('gives each view an overlay root removed with the view unless the caller owns one', async () => {
    const roots: HTMLElement[] = []
    const host = await hostWithPanes({ pane: (_container, _context, viewHost) => {
      roots.push(viewHost.overlayRoot)
    } })
    const owned = document.createElement('div')
    const own = host.mount('acme:pane', document.createElement('div'), snapshot(host, 'a'), { overlayRoot: owned })
    const fallback = host.mount('acme:pane', document.createElement('div'), snapshot(host, 'a'))
    await Promise.all([own.ready, fallback.ready])
    expect(roots[0]).toBe(owned)
    expect(roots[1].isConnected).toBe(true)
    await Promise.all([own.dispose(), fallback.dispose()])
    expect(roots[1].isConnected).toBe(false)
  })

  it('rejects component views, unknown ids, and records failures of app-rendered views', async () => {
    const component = { name: 'Pane' }
    const host = createTestHost([plugin('acme', (api) => {
      api.shell.addPane({ id: 'vue', label: 'Vue', icon: 'plug', component })
    })])
    await host.ready
    await expect(host.mount('acme:vue', document.createElement('div'), host.context).ready).rejects.toThrow(/component/)
    await expect(host.mount('acme:missing', document.createElement('div'), host.context).ready).rejects.toThrow(/acme:missing/)
    const error = new Error('render failed')
    host.reportViewError('acme:vue', error, 'update')
    expect(host.diagnostics()).toEqual([expect.objectContaining({ pluginId: 'acme', contributionId: 'acme:vue', phase: 'update', error })])
  })
})
