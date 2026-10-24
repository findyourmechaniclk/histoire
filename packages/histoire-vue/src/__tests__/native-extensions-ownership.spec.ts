import type { WorkbenchContext, WorkbenchPluginApi } from '@histoire/plugin-kit'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { ExplorerPanels } from '../components/explorer/ExplorerPanels.js'
import { HistoireToolbar } from '../components/toolbar/HistoireToolbar.js'
import { HistoireProvider } from '../provider/HistoireProvider.js'
import { connectedSession, nativeHost, probePlugin, tabLabels } from './fixtures/native-plugins.js'

afterEach(() => {
  document.body.replaceChildren()
})

/**
 * Opens the plugin tab of the first explorer panels under `root`.
 * @param root Element holding the panels.
 * @param label Plugin tab label.
 */
function openTab(root: Element, label: string) {
  Array.from(root.querySelectorAll<HTMLElement>('[role=tab]')).find(tab => tab.textContent?.trim() === label)!.click()
}

describe('native plugin ownership', () => {
  it('keeps two workbenches with different sources and plugins isolated', async () => {
    const first = await connectedSession('first')
    const second = await connectedSession('second')
    const one = probePlugin('one')
    const two = probePlugin('two')
    const hosts = [await nativeHost(first.session, [one.definition]), await nativeHost(second.session, [two.definition])]
    const wrapper = mount({ render: () => [
      h(HistoireProvider, { class: 'first', session: first.session, extensions: hosts[0] }, { default: () => h(ExplorerPanels) }),
      h(HistoireProvider, { class: 'second', session: second.session, extensions: hosts[1] }, { default: () => h(ExplorerPanels) }),
    ] }, { attachTo: document.body })
    await flushPromises()
    const [a, b] = [wrapper.find('.first').element, wrapper.find('.second').element]
    expect(tabLabels(a)).toEqual(['Controls', 'Docs', 'Events', 'Tests', 'one'])
    expect(tabLabels(b)).toEqual(['Controls', 'Docs', 'Events', 'Tests', 'two'])

    await second.session.selection.select({ storyId: 'a:b', variantId: 'c' })
    openTab(a, 'one')
    openTab(b, 'two')
    await flushPromises()
    expect(a.textContent).toContain('one:c')
    expect(b.textContent).toContain('two:c')
    expect(one.spies.mounts).toHaveBeenCalledOnce()
    expect(two.spies.mounts).toHaveBeenCalledOnce()
    await hosts[0].dispose()
    await flushPromises()
    // Disposing one caller host leaves the other workbench untouched.
    expect(two.spies.teardown).not.toHaveBeenCalled()
    expect(b.textContent).toContain('two:c')
    wrapper.unmount()
  })

  it('cleans scoped views on session replacement without disposing the caller host', async () => {
    const first = await connectedSession()
    const second = await connectedSession('replacement')
    const probe = probePlugin('acme')
    const host = await nativeHost(first.session, [probe.definition])
    const wrapper = mount(HistoireProvider, { attachTo: document.body, props: { session: first.session, extensions: host }, slots: { default: () => h(ExplorerPanels, { activePanel: 'acme:panel' }) } })
    await flushPromises()
    expect(wrapper.text()).toContain('acme:c')

    await wrapper.setProps({ session: second.session })
    await flushPromises()
    expect(probe.spies.disposals).toHaveBeenCalledOnce()
    expect(probe.spies.teardown).not.toHaveBeenCalled()
    // Same host, new generation: the tab mounts again for the replacement session.
    expect(probe.spies.mounts).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('acme:c')

    wrapper.unmount()
    expect(probe.spies.disposals).toHaveBeenCalledTimes(2)
    expect(probe.spies.teardown).not.toHaveBeenCalled()
    expect(host.contributions('inspector.tab')).toHaveLength(1)
  })

  it('leaves host-owned URL, title, theme and storage alone; preferences stay in memory', async () => {
    const { session } = await connectedSession()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let api!: WorkbenchPluginApi
    const probe = probePlugin('acme', (value) => {
      api = value
      value.toolbar.addItem({ id: 'go', group: 'plugins', type: 'action', label: 'Go', icon: 'play', run(context: WorkbenchContext) {
        context.navigation.openPane('acme:pane')
        context.navigation.openSettings('acme:section')
        context.navigation.openCanvasView('acme:view')
        context.navigation.openInspectorTab('builtin:docs')
      } })
    })
    const host = await nativeHost(session, [probe.definition])
    document.title = 'Host page'
    const before = { url: location.href, title: document.title, storage: localStorage.length, session: sessionStorage.length }
    const wrapper = mount(HistoireProvider, { attachTo: document.body, props: { session, extensions: host }, slots: { default: () => [h(HistoireToolbar), h(ExplorerPanels)] } })
    await flushPromises()

    api.preferences.set('count', 3)
    expect(api.preferences.get('count', 0)).toBe(3)
    await wrapper.findAll('button').find(button => button.text() === 'Go')!.trigger('click')
    await flushPromises()
    // Inspector navigation stays inside this provider; other destinations do not exist here.
    expect(wrapper.find('[role=tab][aria-selected=true]').text()).toBe('Docs')
    expect(warn).toHaveBeenCalledTimes(3)
    expect({ url: location.href, title: document.title, storage: localStorage.length, session: sessionStorage.length }).toEqual({ url: before.url, title: before.title, storage: before.storage, session: before.session })
    expect(document.documentElement.getAttribute('class')).toBeNull()
    expect(document.documentElement.getAttribute('style')).toBeNull()
    wrapper.unmount()
    warn.mockRestore()
  })
})
