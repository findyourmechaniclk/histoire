import type { ContextMenuContext, FrameScopedContext, WorkbenchPluginApi } from '../../../../histoire-plugin-kit/src/index.js'
import { describe, expect, it, vi } from 'vitest'
import { createContextMenu } from '../../../../histoire-app/src/app/composables/context-menu.js'
import { registerPluginContextMenu, registerPluginFrameMenu } from '../../../../histoire-app/src/app/extensions/menus.js'
import { createFrameActions } from '../../../../histoire-app/src/app/util/frame-actions.js'
import { sourceFixture } from '../../../../histoire-sdk/src/__tests__/fixtures/session.js'
import { createHistoireSessionWithAdapters } from '../../../../histoire-sdk/src/session/controller.js'
import { createSnapshotSession, createTestWorkbenchHost, pluginEntry } from './utils/workbench-extensions.js'

/**
 * Workbench with one plugin, a frame action registry over a real SDK session and a context menu.
 * @param setup Plugin setup.
 */
async function setupMenus(setup: (api: WorkbenchPluginApi) => void) {
  const root = createSnapshotSession({ storyId: 'a:b', variantId: 'c' })
  const { workbench } = createTestWorkbenchHost({ session: root, plugins: [pluginEntry({ id: 'acme', apiVersion: 1, setup })] })
  await workbench.host.ready
  const fixture = sourceFixture()
  const session = createHistoireSessionWithAdapters({ url: 'https://book.example/' }, fixture.adapters)
  await session.connect()
  const error = vi.fn()
  const actions = createFrameActions({ session, link: () => '', reveal: vi.fn(), error })
  const menu = createContextMenu({ error })
  // Each canvas frame owns its own session; the right-clicked one is not the selected one.
  const frames = new Map([['frame-2', createSnapshotSession({ storyId: 'a:b', variantId: 'other' }, { count: 7 })]])
  const stops = [
    registerPluginFrameMenu(workbench, actions, target => frames.get(target.frameKey) ?? root),
    registerPluginContextMenu(workbench, menu),
  ]
  /** Tears down adapters, host and session. */
  async function close() {
    stops.forEach(stop => stop())
    await workbench.dispose()
    await session.dispose()
  }
  return { root, workbench, actions, menu, error, close }
}

describe('plugin menu entries', () => {
  it('run frame-menu actions and their children against the right-clicked frame without selecting it', async () => {
    const seen: Array<{ id: string, frame: string, state: unknown }> = []
    /** Records which frame and runtime state an action observed. */
    const record = (id: string) => (context: FrameScopedContext) => {
      seen.push({ id, frame: context.frame.key, state: context.runtime.getSnapshot().state?.value })
    }
    const { root, actions, error, close } = await setupMenus((api) => {
      api.menus.addFrameAction({ id: 'inspect', label: 'Inspect', icon: 'view', run: record('inspect') })
      api.menus.addFrameAction({ id: 'export', label: 'Export', icon: 'export', run: () => {}, children: [{ id: 'json', label: 'JSON', icon: 'code', run: record('json') }] })
    })
    const target = { storyId: 'a:b', variantId: 'other', frameKey: 'frame-2' }
    try {
      const listed = actions.list(target)
      await actions.run(listed.find(action => action.id === 'acme:inspect')!, target)
      const [child] = listed.find(action => action.id === 'acme:export')!.children!(target)
      expect(child.id).toBe('acme:export:json')
      await actions.run(child, target)

      expect(error).not.toHaveBeenCalled()
      expect(seen).toEqual([
        { id: 'inspect', frame: 'frame-2', state: { count: 7 } },
        { id: 'json', frame: 'frame-2', state: { count: 7 } },
      ])
      expect(root.getSnapshot().selection).toEqual({ storyId: 'a:b', variantId: 'c' })
    }
    finally { await close() }
  })

  it('reports frame-menu failures through the menu', async () => {
    const failure = new Error('inspect failed')
    const { actions, error, close } = await setupMenus((api) => {
      api.menus.addFrameAction({ id: 'inspect', label: 'Inspect', icon: 'view', run: () => {
        throw failure
      } })
    })
    const target = { storyId: 'a:b', variantId: 'c', frameKey: 'frame-1' }
    try {
      await actions.run(actions.entries.get('acme:inspect')!, target)
      expect(error).toHaveBeenCalledWith(failure)
    }
    finally { await close() }
  })

  it('show context-menu entries only on their target kinds and run them with the captured target', async () => {
    const seen: ContextMenuContext['target'][] = []
    const { menu, close } = await setupMenus((api) => {
      api.menus.addContextAction({ id: 'pin', targets: ['story'], label: 'Pin story', run: context => void seen.push(context.target) })
    })
    const story = { kind: 'story' as const, label: 'Button', key: 'a:b', selection: { storyId: 'a:b' } }
    const folder = { kind: 'folder' as const, label: 'components', key: 'folder:components', expanded: false }
    try {
      expect(menu.list(folder).map(action => action.id)).not.toContain('acme:pin')
      const pin = menu.list(story).find(action => action.id === 'acme:pin')!
      await menu.run(pin, story)

      expect(seen).toEqual([{ kind: 'story', label: 'Button', key: 'a:b', selection: { storyId: 'a:b', variantId: null } }])
    }
    finally { await close() }
  })
})
