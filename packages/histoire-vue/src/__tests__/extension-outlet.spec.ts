import type { ExtensionHost, ViewMount, WorkbenchContext, WorkbenchPluginApi } from '../../../histoire-plugin-kit/src/index.js'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject, nextTick, provide, ref } from 'vue'
import ExtensionOutlet from '../../../histoire-app/src/app/components/extensions/ExtensionOutlet.vue'
import { createExtensionHost, defineWorkbenchPlugin } from '../../../histoire-plugin-kit/src/index.js'
import { useWorkbenchContext } from '../../../histoire-plugin-kit/src/vue/index.js'

/** Context snapshots tagged so views can show which one they received. */
type Tagged = WorkbenchContext & { tag: string }

/** Root context with inert services; tests pass tagged copies to outlets. */
const root: WorkbenchContext = {
  capabilities: new Set(),
  source: { mode: 'dev' },
  catalog: {} as WorkbenchContext['catalog'],
  selection: { target: null },
  navigation: {} as WorkbenchContext['navigation'],
  subscribe: () => () => {},
}

/** Plugin Vue view: prop and `useWorkbenchContext` stay live, local state, workbench injection. */
const CounterPane = defineComponent({
  props: { context: { type: Object, required: true } },
  setup(props) {
    const live = useWorkbenchContext<Tagged>()
    const theme = inject('workbench-theme', 'missing')
    const clicks = ref(0)
    return () => h('button', { onClick: () => clicks.value++ }, `${(props.context as Tagged).tag}/${live.tag}/${theme}:${clicks.value}`)
  },
})

/** Plugin Vue view failing on its first render. */
const BrokenPane = defineComponent(() => () => {
  throw new Error('render failed')
})

let host: ExtensionHost | undefined

afterEach(async () => {
  await host?.dispose()
  document.body.replaceChildren()
})

/**
 * Host with one plugin whose setup registers panes, then an outlet of rail panes inside a
 * workbench-like parent providing a theme key.
 * @param setup Registers the plugin's panes.
 */
async function mountOutlet(setup: (api: WorkbenchPluginApi) => void) {
  host = createExtensionHost({ plugins: [defineWorkbenchPlugin({ id: 'acme', apiVersion: 1, setup })], services: { context: root } })
  await host.ready
  const context = ref<Tagged>({ ...root, tag: 'a' })
  const outletHost = host
  const Workbench = defineComponent(() => {
    provide('workbench-theme', 'dark')
    return () => h('div', { class: 'histoire-app' }, h(ExtensionOutlet, { host: outletHost, kind: 'shell.pane', context: context.value }))
  })
  const wrapper = mount(Workbench, { attachTo: document.body })
  await nextTick()
  return { wrapper, context, host: outletHost }
}

describe('extension outlet', () => {
  it('pushes context to Vue component views without remounting them', async () => {
    const { wrapper, context } = await mountOutlet((api) => {
      api.shell.addPane({ id: 'counter', label: 'Counter', icon: 'plug', component: CounterPane })
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button').text()).toBe('a/a/dark:1')
    context.value = { ...root, tag: 'b' }
    await nextTick()
    expect(wrapper.get('button').text()).toBe('b/b/dark:1')
    wrapper.unmount()
  })

  it('isolates failing views and disposes DOM views with the outlet', async () => {
    const dispose = vi.fn()
    const update = vi.fn()
    const mountPane: ViewMount<Tagged> = (container, context) => {
      container.textContent = `dom ${context.tag}`
      return { update, dispose }
    }
    const { wrapper, context, host } = await mountOutlet((api) => {
      api.shell.addPane({ id: 'broken', label: 'Broken', icon: 'plug', component: BrokenPane })
      api.shell.addPane({ id: 'throws', label: 'Throws', icon: 'plug', mount: () => {
        throw new Error('mount failed')
      } })
      api.shell.addPane({ id: 'dom', label: 'Dom', icon: 'plug', mount: mountPane as ViewMount<WorkbenchContext> })
      api.shell.addPane({ id: 'counter', label: 'Counter', icon: 'plug', component: CounterPane })
    })
    await new Promise(resolve => setTimeout(resolve))
    await nextTick()
    expect(wrapper.findAll('[role="alert"]').map(alert => alert.text())).toEqual([
      expect.stringContaining('render failed'),
      expect.stringContaining('mount failed'),
    ])
    expect(wrapper.text()).toContain('dom a')
    expect(wrapper.get('button').text()).toBe('a/a/dark:0')
    expect(host.diagnostics().map(entry => [entry.contributionId, entry.phase])).toEqual([
      ['acme:broken', 'mount'],
      ['acme:throws', 'mount'],
    ])

    context.value = { ...root, tag: 'b' }
    await nextTick()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ tag: 'b' }))
    wrapper.unmount()
    await new Promise(resolve => setTimeout(resolve))
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('renders contributions registered after mount and drops removed ones', async () => {
    let api!: WorkbenchPluginApi
    const { wrapper } = await mountOutlet((pluginApi) => {
      api = pluginApi
    })
    const remove = api.shell.addPane({ id: 'late', label: 'Late', icon: 'plug', component: CounterPane })
    await nextTick()
    expect(wrapper.find('button').exists()).toBe(true)
    remove()
    await nextTick()
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
})
