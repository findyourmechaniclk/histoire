import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { ExplorerPanels } from '../components/explorer/ExplorerPanels.js'
import { HistoireExplorer } from '../components/explorer/HistoireExplorer.js'
import { HistoireToolbar } from '../components/toolbar/HistoireToolbar.js'
import { HistoireProvider } from '../provider/HistoireProvider.js'
import { connectedSession, nativeHost, press, probePlugin, tabLabels } from './fixtures/native-plugins.js'

afterEach(() => {
  document.body.replaceChildren()
})

describe('native plugin surfaces', () => {
  it('renders plugin tabs, sections and toolbar items after the shared built-ins', async () => {
    const { session } = await connectedSession()
    const probe = probePlugin('acme')
    const host = await nativeHost(session, [probe.definition])
    const wrapper = mount(HistoireProvider, { attachTo: document.body, props: { session, extensions: host }, slots: { default: () => [h(HistoireToolbar), h(ExplorerPanels)] } })
    await flushPromises()

    expect(tabLabels(wrapper.element)).toEqual(['Controls', 'Docs', 'Events', 'Tests', 'acme'])
    // Section after the Props (Controls) body, bound to the selected variant.
    expect(wrapper.find('.histoire-explorer-panel .section-probe').text()).toBe('section:c')
    await wrapper.findAll('[role=tab]')[4].trigger('click')
    expect(wrapper.find('.histoire-explorer-panel').text()).toContain('acme:c')
    expect(wrapper.find('.section-probe').exists()).toBe(false)

    const ping = wrapper.findAll('button').find(button => button.text() === 'acme ping')!
    await ping.trigger('click')
    await flushPromises()
    expect(probe.spies.runs).toHaveBeenCalledOnce()
    expect(probe.spies.runs.mock.calls[0][0].selection.target).toEqual({ storyId: 'a:b', variantId: 'c' })
    wrapper.unmount()
    expect(probe.spies.disposals).toHaveBeenCalledOnce()
  })

  it('lets caller slots replace native surfaces without plugin contributions', async () => {
    const { session } = await connectedSession()
    const probe = probePlugin('acme')
    const host = await nativeHost(session, [probe.definition])
    const wrapper = mount(HistoireProvider, { attachTo: document.body, props: { session, extensions: host }, slots: { default: () => h(HistoireExplorer, { showNavigation: false }, {
      toolbar: () => h('div', 'own toolbar'),
      preview: () => h('div', 'own canvas'),
      panels: () => h('div', 'own panels'),
    }) } })
    await flushPromises()
    expect(wrapper.text()).toContain('own panels')
    expect(wrapper.find('[role=tab]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('acme ping')
    expect(probe.spies.mounts).not.toHaveBeenCalled()
    // Contributions stay registered for surfaces the caller still renders natively.
    expect(host.contributions('inspector.tab')).toHaveLength(1)
    wrapper.unmount()
  })

  it('reuses the root host in nested providers and binds shortcuts only where the host is owned', async () => {
    const { session } = await connectedSession()
    const { session: nested } = await connectedSession('nested')
    const setup = vi.fn()
    const probe = probePlugin('acme', (api) => {
      setup()
      api.shortcuts.add({ id: 'keys', command: 'acme:run', keys: ['mod+shift+y'], scope: 'global' })
      api.shortcuts.add({ id: 'search', command: 'acme:run', keys: ['mod+k'], scope: 'global' })
    })
    const host = await nativeHost(session, [probe.definition])
    const wrapper = mount(HistoireProvider, { attachTo: document.body, props: { session, extensions: host }, slots: { default: () => [
      h('button', { class: 'outer' }, 'outer'),
      h(HistoireProvider, { session: nested }, { default: () => [h('button', { class: 'inner' }, 'inner'), h(ExplorerPanels)] }),
    ] } })
    await flushPromises()

    expect(tabLabels(wrapper.find('.histoire-explorer-panels').element)).toContain('acme')
    expect(setup).toHaveBeenCalledOnce()

    press(wrapper.find('.outer').element, { key: 'y', ctrlKey: true, shiftKey: true })
    await flushPromises()
    expect(probe.spies.runs).toHaveBeenCalledOnce()
    // Nested providers never claim keys for a host they only reuse.
    press(wrapper.find('.inner').element, { key: 'y', ctrlKey: true, shiftKey: true })
    await flushPromises()
    expect(probe.spies.runs).toHaveBeenCalledOnce()
    // Built-in bindings win: the overlapping plugin shortcut is disabled with a diagnostic.
    press(wrapper.find('.outer').element, { key: 'k', ctrlKey: true })
    await flushPromises()
    expect(probe.spies.runs).toHaveBeenCalledOnce()
    expect(host.diagnostics()).toEqual([expect.objectContaining({ pluginId: 'acme', contributionId: 'acme:search', phase: 'report' })])
    wrapper.unmount()
  })
})
