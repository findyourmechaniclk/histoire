import type { WorkbenchPluginApi } from '@histoire/plugin-kit'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { HistoireExplorer } from '../components/explorer/HistoireExplorer.js'
import { HistoireToolbar } from '../components/toolbar/HistoireToolbar.js'
import { HistoireProvider } from '../provider/HistoireProvider.js'
import { connectedSession, nativeHost, press, probePlugin } from './fixtures/native-plugins.js'

afterEach(() => {
  document.body.replaceChildren()
})

/** Accessible names of the toolbar's controls, in document order. */
function toolbarControls(element: Element): string[] {
  return Array.from(element.querySelectorAll('.histoire-toolbar input, .histoire-toolbar button'), control => control.getAttribute('aria-label') ?? control.textContent?.trim() ?? '')
}

/**
 * Adds one command per name, recording runs in `runs`.
 * @param api Plugin API.
 * @param runs Receives the qualified command id on each run.
 * @param names Local command ids.
 */
function addCommands(api: WorkbenchPluginApi, runs: ReturnType<typeof vi.fn>, names: string[]) {
  for (const name of names) api.commands.add({ id: name, label: name, icon: 'play', run: () => void runs(`${api.id}:${name}`) })
}

describe('native plugin placement', () => {
  it('places toolbar items after the native group they name and others in a trailing group', async () => {
    const { session } = await connectedSession()
    const probe = probePlugin('acme', (api) => {
      for (const group of ['ui', 'zoom', 'viewport', 'background'] as const) api.toolbar.addItem({ id: group, group, type: 'action', label: `acme ${group}`, icon: 'play', run() {} })
    })
    const host = await nativeHost(session, [probe.definition])
    const wrapper = mount(HistoireProvider, { attachTo: document.body, props: { session, extensions: host }, slots: { default: () => h(HistoireToolbar) } })
    await flushPromises()

    expect(toolbarControls(wrapper.element)).toEqual([
      'Viewport width',
      'Viewport height',
      'Rotate',
      'Viewport preset',
      'acme viewport',
      'Background',
      'Checkerboard',
      'acme background',
      'Direction',
      'Appearance',
      'acme ui',
      'Open in editor',
      // No native zoom group: trailing plugins group, registry order.
      'acme ping',
      'acme zoom',
    ])
    wrapper.unmount()
  })

  it('runs canvas and frame shortcuts in the explorer focus areas, frame first', async () => {
    const { session } = await connectedSession()
    const runs = vi.fn()
    const probe = probePlugin('acme', (api) => {
      addCommands(api, runs, ['global', 'canvas', 'frame'])
      api.shortcuts.add({ id: 'global-key', command: 'acme:global', keys: ['shift+g'], scope: 'global' })
      api.shortcuts.add({ id: 'canvas-key', command: 'acme:canvas', keys: ['shift+j'], scope: 'canvas' })
      api.shortcuts.add({ id: 'frame-key', command: 'acme:frame', keys: ['shift+j'], scope: 'frame' })
    })
    const host = await nativeHost(session, [probe.definition])
    const wrapper = mount(HistoireProvider, { attachTo: document.body, props: { session, extensions: host }, slots: { default: () => h(HistoireExplorer, { showNavigation: false }) } })
    await vi.waitFor(() => expect(wrapper.find('.histoire-primary-frame').exists()).toBe(true))
    const toolbar = wrapper.get('.histoire-toolbar button').element
    const canvas = wrapper.get('.histoire-explorer-layout').element
    const frame = wrapper.get('.histoire-primary-frame').element

    for (const target of [toolbar, canvas, frame]) {
      press(target, { key: 'J', shiftKey: true })
      press(target, { key: 'G', shiftKey: true })
    }
    await flushPromises()
    // Outside the canvas only global shortcuts run; the frame area also belongs to the canvas.
    expect(runs.mock.calls.map(([name]) => name)).toEqual(['acme:global', 'acme:canvas', 'acme:global', 'acme:frame', 'acme:global'])
    expect(host.diagnostics()).toEqual([])
    wrapper.unmount()
  })

  it('reports conflicts and scopes without a native surface at registration, keeping commands', async () => {
    const { session } = await connectedSession()
    const runs = vi.fn()
    const first = probePlugin('first', (api) => {
      addCommands(api, runs, ['sync'])
      api.shortcuts.add({ id: 'sync-key', command: 'first:sync', keys: ['mod+shift+y'], scope: 'global' })
    })
    const second = probePlugin('second', (api) => {
      addCommands(api, runs, ['sync', 'note'])
      api.shortcuts.add({ id: 'sync-key', command: 'second:sync', keys: ['ctrl+shift+y'], scope: 'global' })
      api.shortcuts.add({ id: 'search-key', command: 'second:sync', keys: ['mod+k'], scope: 'global' })
      api.shortcuts.add({ id: 'note-key', command: 'second:note', keys: ['shift+n'], scope: 'comment' })
    })
    const host = await nativeHost(session, [first.definition, second.definition])
    const wrapper = mount(HistoireProvider, { attachTo: document.body, props: { session, extensions: host }, slots: { default: () => h('button', 'inside') } })
    await flushPromises()

    // Before any key press: the later overlapping binding, the built-in overlap and the comment
    // scope (no native surface) are each disabled with one diagnostic.
    const reported = host.diagnostics().map(diagnostic => [diagnostic.contributionId, (diagnostic.error as Error).message])
    expect(reported).toEqual([
      ['second:sync-key', expect.stringContaining('"first:sync-key"')],
      ['second:search-key', expect.stringContaining('built-in "global.search"')],
      ['second:note-key', expect.stringContaining('scope "comment"')],
    ])
    press(wrapper.get('button').element, { key: 'y', ctrlKey: true, shiftKey: true })
    await flushPromises()
    expect(runs.mock.calls).toEqual([['first:sync']])
    expect(host.diagnostics()).toHaveLength(3)
    // Disabled bindings leave their commands available.
    expect(host.contributions('command').map(command => command.id)).toEqual(expect.arrayContaining(['second:sync', 'second:note']))
    wrapper.unmount()
  })
})
