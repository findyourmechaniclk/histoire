import type { WorkbenchPluginApi } from '../../../histoire-plugin-kit/src/index.js'
import { createHistoireSessionWithAdapters } from '@histoire/sdk/internal'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import ShellLayout from '../../../histoire-app/src/app/components/shell/ShellLayout.vue'
import { provideExtensionHost } from '../../../histoire-app/src/app/composables/extensions.js'
import { provideShell } from '../../../histoire-app/src/app/composables/shell.js'
import { activateWorkspacePane } from '../../../histoire-app/src/app/standalone/workbench-navigation.js'
import { createShell, SHELL_STORAGE_KEY } from '../../../histoire-app/src/app/stores/shell.js'
import { sourceFixture } from '../../../histoire-sdk/src/__tests__/fixtures/session.js'
import { flushMicrotasks } from '../../../histoire/src/node/__tests__/utils/flush.js'
import { deferred } from '../../../histoire/src/node/__tests__/utils/mcp/deferred.js'
import { createTestWorkbenchHost, pluginEntry } from '../../../histoire/src/node/__tests__/utils/workbench-extensions.js'
import { HistoireProvider } from '../provider/HistoireProvider.js'

vi.mock('@histoire/vue/internal', () => import('../internal.js'))

const cleanups: (() => unknown)[] = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
  window.localStorage.removeItem(SHELL_STORAGE_KEY)
  document.body.replaceChildren()
})

/** Plugin contributing one Vue rail pane with a focusable control, plus a dev-only pane. */
const notes = { id: 'acme', apiVersion: 1 as const, setup(api: WorkbenchPluginApi) {
  api.shell.addPane({ id: 'notes', label: 'Notes', icon: 'document', component: defineComponent(() => () => h('button', { class: 'notes-body' }, 'notes body')) })
  api.shell.addPane({ id: 'probe', label: 'Probe', icon: 'terminal', devOnly: true, mount: () => {} })
} }

/**
 * Mounts the shell layout inside a provider with a workbench extension host. Rail pane
 * activations toggle panes like the standalone workbench does.
 * @param options Plugin loader override and source mode.
 * @param options.load Pending or failing plugin import.
 * @param options.mode Story source mode.
 * @param options.plugin Plugin replacing `notes`.
 */
async function mountShell(options: { load?: () => Promise<{ default: unknown }>, mode?: 'dev' | 'static', plugin?: typeof notes } = {}) {
  const session = createHistoireSessionWithAdapters({ url: 'https://book.example/' }, sourceFixture().adapters)
  await session.connect()
  const { workbench } = createTestWorkbenchHost({ session, mode: options.mode ?? 'dev', plugins: [pluginEntry(options.plugin ?? notes, options.load)] })
  const shell = createShell({ dev: true, storage: window.localStorage })
  cleanups.push(() => session.dispose(), () => workbench.dispose(), () => shell.close())
  const Workbench = defineComponent(() => {
    provideShell(shell)
    provideExtensionHost(workbench)
    return () => h(ShellLayout, { homeHref: '/', onPane: shell.selectPane }, { stories: () => h('p', 'stories pane') })
  })
  const wrapper = mount(HistoireProvider, { props: { session }, slots: { default: () => h(Workbench) }, attachTo: document.body })
  cleanups.push(() => wrapper.unmount())
  return { wrapper, shell, workbench }
}

/** Lets plugin setup settle and Vue apply the resulting registry and shell updates. */
async function settle(): Promise<void> {
  await flushMicrotasks(20)
  await nextTick()
}

describe('plugin rail panes', () => {
  it('opens from the rail inside the pane layout and restores rail focus on close', async () => {
    const { wrapper, shell } = await mountShell()
    await settle()

    await wrapper.get('[aria-label="Notes"]').trigger('click')
    expect(shell.pane.value).toBe('acme:notes')
    expect(wrapper.get('aside').attributes('aria-label')).toBe('Notes panel')
    expect(wrapper.get('aside h2').text()).toBe('Notes')
    const body = wrapper.get<HTMLButtonElement>('.notes-body')
    body.element.focus()

    shell.togglePanel()
    await nextTick()
    await nextTick()
    expect(wrapper.find('.notes-body').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Notes"]').element)
  })

  it('re-reads a pane badge when the plugin invalidates its state', async () => {
    let count = 0
    let invalidate!: () => void
    const { wrapper } = await mountShell({ plugin: { id: 'acme', apiVersion: 1, setup(api) {
      invalidate = api.invalidate
      api.shell.addPane({ id: 'notes', label: 'Notes', icon: 'document', badge: () => count, mount: () => {} })
    } } })
    await settle()
    expect(wrapper.find('[aria-label="Notes"]').exists()).toBe(true)

    count = 2
    invalidate()
    await nextTick()
    expect(wrapper.find('[aria-label="Notes (2)"]').exists()).toBe(true)
  })

  it('opens when navigating from Settings to the workspace', async () => {
    const { wrapper, shell } = await mountShell()
    await settle()
    // Settings hides every pane.
    shell.selectPane('home')
    let route = 'settings'

    await activateWorkspacePane({
      pane: 'acme:notes',
      currentRoute: () => route,
      selection: () => null,
      navigation: { restore: async () => {}, home: async () => void (route = 'home') },
      showPane: shell.selectPane,
      togglePane: shell.selectPane,
    })
    await nextTick()

    expect(wrapper.text()).toContain('notes body')
  })

  it('shows a loading state for a persisted plugin pane until setup settles, then recovers to Stories', async () => {
    window.localStorage.setItem(SHELL_STORAGE_KEY, JSON.stringify({ pane: 'acme:removed', panelOpen: true }))
    const load = deferred<{ default: unknown }>()
    const { wrapper, shell } = await mountShell({ load: () => load.promise })
    await settle()
    expect(shell.pane.value).toBe('acme:removed')
    expect(wrapper.get('aside [role="status"]').text()).toContain('Loading')

    load.resolve({ default: notes })
    await settle()

    expect(shell.pane.value).toBe('stories')
    expect(wrapper.get('aside').text()).toContain('stories pane')
    expect(wrapper.find('[aria-label="Notes"]').exists()).toBe(true)
  })

  it('omits dev-only panes from static books and recovers a persisted one', async () => {
    window.localStorage.setItem(SHELL_STORAGE_KEY, JSON.stringify({ pane: 'acme:probe', panelOpen: true }))
    const { wrapper, shell } = await mountShell({ mode: 'static' })
    await settle()

    expect(wrapper.find('[aria-label="Notes"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Probe"]').exists()).toBe(false)
    expect(shell.pane.value).toBe('stories')
  })
})
