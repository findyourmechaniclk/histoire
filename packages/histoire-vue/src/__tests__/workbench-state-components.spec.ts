import type { WorkbenchComponents, WorkbenchPluginApi } from '../../../histoire-plugin-kit/src/index.js'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onUnmounted, provide } from 'vue'
import ExtensionView from '../../../histoire-app/src/app/components/extensions/ExtensionView.vue'
import AppEmptyState from '../../../histoire-app/src/app/components/shell/WorkbenchEmptyState.vue'
import { WORKBENCH_COMPONENTS_KEY } from '../../../histoire-plugin-kit/src/index.js'
import { WorkbenchEmptyState } from '../../../histoire-plugin-kit/src/vue/index.js'
import { ExplorerPanels } from '../components/explorer/ExplorerPanels.js'
import { histoireWorkbenchComponents } from '../components/extensions/workbench-components.js'
import { HistoireProvider } from '../provider/HistoireProvider.js'
import { connectedSession, nativeHost, probePlugin } from './fixtures/native-plugins.js'

afterEach(() => {
  document.body.replaceChildren()
})

/** Plugin Vue section showing the shared empty state. */
const EmptySection = defineComponent(() => () => h(WorkbenchEmptyState, { icon: 'search', title: 'No issues' }, () => 'All targets pass'))

/**
 * Adds a Vue section using the shared empty state and a DOM section rendering an error state
 * through its view host, both before the Props body.
 * @param api Plugin API.
 */
function addStateSections(api: WorkbenchPluginApi) {
  api.inspector.addSection({ id: 'empty', tab: 'builtin:props', position: 'before', component: EmptySection })
  api.inspector.addSection({ id: 'error', tab: 'builtin:props', position: 'before', mount(container, _context, host) {
    host.renderState(container, { kind: 'error', title: 'Audit failed', detail: 'Frame detached' })
  } })
}

/**
 * Mounts native panels of a host with the state sections, under an optional enclosing
 * workbench that provides its own components first.
 * @param enclosing Setup of the enclosing workbench component.
 * @param sections Plugin setup registering the sections.
 */
async function mountPanels(enclosing?: () => void, sections = addStateSections) {
  const { session } = await connectedSession()
  const host = await nativeHost(session, [probePlugin('acme', sections).definition])
  const Workbench = defineComponent(() => {
    enclosing?.()
    return () => h(HistoireProvider, { session, extensions: host }, () => h(ExplorerPanels))
  })
  const wrapper = mount(Workbench, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('workbench state components in hosts', () => {
  it('render with the native provider components for Vue and DOM views', async () => {
    const wrapper = await mountPanels()

    expect(wrapper.findComponent(histoireWorkbenchComponents.WorkbenchEmptyState!).props()).toEqual({ icon: 'search', title: 'No issues' })
    const alert = wrapper.get('[data-histoire-contribution="acme:error"] [role="alert"]')
    expect(alert.text()).toContain('Audit failed')
    expect(alert.text()).toContain('Frame detached')
    wrapper.unmount()
  })

  it('keep the components an enclosing workbench provides and release DOM states with the view', async () => {
    const released = vi.fn()
    const components: WorkbenchComponents = {
      WorkbenchEmptyState: defineComponent({ props: ['icon', 'title'], setup: props => () => h('p', `workbench empty: ${props.title}`) }),
      WorkbenchErrorState: defineComponent({ props: ['icon', 'title'], setup(props, { slots }) {
        onUnmounted(released)
        return () => h('p', [`workbench error: ${props.title} `, slots.default?.()])
      } }),
    }
    const wrapper = await mountPanels(() => provide(WORKBENCH_COMPONENTS_KEY, components))

    expect(wrapper.text()).toContain('workbench empty: No issues')
    expect(wrapper.get('[data-histoire-contribution="acme:error"]').text()).toBe('workbench error: Audit failed Frame detached')
    wrapper.unmount()
    expect(released).toHaveBeenCalledOnce()
  })

  it('show pending and failed native views with the provided state components', async () => {
    const components: WorkbenchComponents = {
      WorkbenchLoadingState: defineComponent({ props: ['title'], setup: props => () => h('p', `workbench loading: ${props.title}`) }),
      WorkbenchErrorState: defineComponent({ props: ['icon', 'title'], setup: (props, { slots }) => () => h('p', [`workbench error: ${props.title} `, slots.default?.()]) }),
    }
    const wrapper = await mountPanels(() => provide(WORKBENCH_COMPONENTS_KEY, components), (api) => {
      api.inspector.addSection({ id: 'slow', tab: 'builtin:props', position: 'before', mount: () => new Promise(() => {}) })
      api.inspector.addSection({ id: 'broken', tab: 'builtin:props', position: 'before', mount: () => {
        throw new Error('mount failed')
      } })
    })

    expect(wrapper.get('[data-histoire-contribution="acme:slow"]').text()).toBe('workbench loading: Loading extension')
    expect(wrapper.get('[data-histoire-contribution="acme:broken"]').text()).toBe('workbench error: Extension failed mount failed')
    wrapper.unmount()
  })

  it('use the standalone workbench components in standalone views', async () => {
    const { session } = await connectedSession()
    const host = await nativeHost(session, [probePlugin('acme', addStateSections).definition])
    const contribution = host.contributions('inspector.section').find(item => item.id === 'acme:empty')!
    const wrapper = mount(ExtensionView, { attachTo: document.body, props: { host, contribution, context: {} } })

    const state = wrapper.findComponent(AppEmptyState)
    expect(state.props('icon')).toBe('search')
    expect(state.get('[role="status"] strong').text()).toBe('No issues')
    expect(state.get('[role="status"] p').text()).toBe('All targets pass')
    wrapper.unmount()
  })
})
