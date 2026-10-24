import type { WorkbenchContext, WorkbenchPluginApi } from '../../../histoire-plugin-kit/src/index.js'
import { createHistoireSessionWithAdapters } from '@histoire/sdk/internal'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import SearchPanel from '../../../histoire-app/src/app/components/panes/search/SearchPanel.vue'
import { createContextMenu } from '../../../histoire-app/src/app/composables/context-menu.js'
import { registerPluginCommands } from '../../../histoire-app/src/app/extensions/commands.js'
import { registerPluginContextMenu, registerPluginFrameMenu } from '../../../histoire-app/src/app/extensions/menus.js'
import { listPluginToolbarItems } from '../../../histoire-app/src/app/extensions/toolbar.js'
import { createStandaloneCommands } from '../../../histoire-app/src/app/standalone/commands.js'
import { createFrameActions } from '../../../histoire-app/src/app/util/frame-actions.js'
import { sourceFixture } from '../../../histoire-sdk/src/__tests__/fixtures/session.js'
import { createTestWorkbenchHost, pluginEntry } from '../../../histoire/src/node/__tests__/utils/workbench-extensions.js'
import { HistoireProvider } from '../provider/HistoireProvider.js'
import { virtualViewport } from './fixtures/virtual-viewport.js'

vi.mock('@histoire/vue/internal', () => import('../internal.js'))
vi.mock('virtual:$histoire-commands', () => ({ registeredCommands: [{ id: 'node-backed', label: 'Node backed' }] }))
vi.mock('virtual:$histoire-stories', () => ({ files: [], onUpdate: () => () => {} }))
beforeEach(() => virtualViewport())
afterEach(() => vi.restoreAllMocks())

/**
 * SDK session over the shared source fixture in the given source mode.
 * @param mode Story source mode.
 */
async function connectedSession(mode: 'dev' | 'static') {
  const fixture = sourceFixture()
  fixture.descriptor.mode = mode
  const session = createHistoireSessionWithAdapters({ url: 'https://book.example/' }, fixture.adapters)
  await session.connect()
  return session
}

/**
 * Plugin contributing one action to every action surface with the same gate.
 * @param gate `devOnly` flag or an equivalent availability predicate.
 * @param run Shared action.
 */
function everywhere(gate: 'devOnly' | 'predicate', run: () => void) {
  const gating = gate === 'devOnly' ? { devOnly: true } : { available: (context: WorkbenchContext) => context.source.mode === 'dev' }
  return pluginEntry({ id: 'acme', apiVersion: 1, setup(api: WorkbenchPluginApi) {
    api.toolbar.addItem({ id: 'sync-button', group: 'plugins', type: 'action', label: 'Sync', icon: 'renew', run, ...gating })
    api.commands.add({ id: 'sync', label: 'Sync', icon: 'renew', run, ...gating })
    api.menus.addFrameAction({ id: 'sync-frame', label: 'Sync', icon: 'renew', run, ...gating })
    api.menus.addContextAction({ id: 'sync-story', targets: ['story'], label: 'Sync', run, ...gating })
  } })
}

describe('plugin action availability', () => {
  it.each(['devOnly', 'predicate'] as const)('applies %s identically to toolbar, menus and command search', async (gate) => {
    for (const mode of ['dev', 'static'] as const) {
      const { workbench } = createTestWorkbenchHost({ mode, plugins: [everywhere(gate, vi.fn())] })
      await workbench.host.ready
      const session = await connectedSession(mode)
      const actions = createFrameActions({ session, link: () => '', reveal: vi.fn() })
      const menu = createContextMenu()
      const commands = createStandaloneCommands(session, createRouter({ history: createMemoryHistory(), routes: [] }))
      const stops = [registerPluginFrameMenu(workbench, actions, () => session), registerPluginContextMenu(workbench, menu), registerPluginCommands(workbench, commands)]
      try {
        const visible = {
          toolbar: listPluginToolbarItems(workbench).plugins.map(item => item.id),
          frame: actions.list({ storyId: 'a:b', variantId: 'c', frameKey: 'frame' }).map(action => action.id).filter(id => id.startsWith('acme:')),
          context: menu.list({ kind: 'story', label: 'Button', selection: { storyId: 'a:b' } }).map(action => action.id),
          commands: commands.list('sync').map(command => command.id),
        }
        const shown = mode === 'dev'
        expect(visible).toEqual({
          toolbar: shown ? ['acme:sync-button'] : [],
          frame: shown ? ['acme:sync-frame'] : [],
          context: shown ? ['acme:sync-story'] : [],
          commands: shown ? ['acme:sync'] : [],
        })
      }
      finally {
        stops.forEach(stop => stop())
        commands.close()
        await workbench.dispose()
        await session.dispose()
      }
    }
  })

  it('lists plugin commands in static books, keeps Node-backed commands dev-only and runs once from search', async () => {
    const run = vi.fn()
    const { workbench } = createTestWorkbenchHost({ mode: 'static', plugins: [pluginEntry({ id: 'acme', apiVersion: 1, setup(api) {
      api.commands.add({ id: 'sync', label: 'Sync plugin', icon: 'renew', run })
    } })] })
    await workbench.host.ready
    const session = await connectedSession('static')
    const commands = createStandaloneCommands(session, createRouter({ history: createMemoryHistory(), routes: [] }))
    const stop = registerPluginCommands(workbench, commands)
    const wrapper = mount(HistoireProvider, { props: { session }, slots: { default: () => h(SearchPanel, { commands }) } })
    try {
      await wrapper.get('input').setValue('>')
      await vi.waitFor(() => expect(wrapper.findAll('[data-search-kind=command]').map(button => button.text())).toEqual(['Sync plugin']))
      await wrapper.get('[data-search-kind=command]').trigger('click')
      await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1))
      expect(run.mock.calls[0][0].source.mode).toBe('static')
    }
    finally {
      wrapper.unmount()
      stop()
      commands.close()
      await workbench.dispose()
      await session.dispose()
    }
  })
})
