import type { WorkbenchPluginApi } from '../../../histoire-plugin-kit/src/index.js'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import SettingsPage from '../../../histoire-app/src/app/components/pages/settings/SettingsPage.vue'
import { provideExtensionHost } from '../../../histoire-app/src/app/composables/extensions.js'
import { flushMicrotasks } from '../../../histoire/src/node/__tests__/utils/flush.js'
import { deferred } from '../../../histoire/src/node/__tests__/utils/mcp/deferred.js'
import { memoryStorage } from '../../../histoire/src/node/__tests__/utils/settings-storage.js'
import { createTestWorkbenchHost, pluginEntry } from '../../../histoire/src/node/__tests__/utils/workbench-extensions.js'

const cleanups: (() => unknown)[] = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

/** Plugin settings section toggling one plugin preference. */
const plugin = { id: 'acme', apiVersion: 1 as const, setup(api: WorkbenchPluginApi) {
  api.settings.addSection({ id: 'prefs', label: 'Acme', icon: 'settings-adjust', component: defineComponent(() => () => h('button', { class: 'acme-toggle', onClick: () => api.preferences.set('compact', true) }, 'Compact')) })
} }

/**
 * Mounts the settings page at one section with a workbench extension host.
 * @param section Route section parameter.
 * @param load Optional pending plugin import.
 */
function mountSettings(section: string, load?: () => Promise<{ default: unknown }>) {
  const storage = memoryStorage()
  const { workbench } = createTestWorkbenchHost({ plugins: [pluginEntry(plugin, load)], storage, storageNamespace: '_histoire-ui:https://book.example/' })
  cleanups.push(() => workbench.dispose())
  const Workbench = defineComponent((_props, { emit }) => {
    provideExtensionHost(workbench)
    return () => h(SettingsPage, { section, onSection: (value: string) => emit('section', value) })
  }, { emits: ['section'] })
  const wrapper = mount(Workbench, { attachTo: document.body })
  cleanups.push(() => wrapper.unmount())
  return { wrapper, storage }
}

/** Lets plugin setup settle and Vue apply the resulting registry updates. */
async function settle(): Promise<void> {
  await flushMicrotasks(20)
  await nextTick()
}

describe('plugin settings sections', () => {
  it('waits for plugin setup, then renders the section listed after built-ins', async () => {
    const load = deferred<{ default: unknown }>()
    const { wrapper } = mountSettings('acme:prefs', () => load.promise)
    await settle()
    expect(wrapper.get('main [role="status"]').text()).toContain('Loading')
    expect(wrapper.emitted('section')).toBeUndefined()

    load.resolve({ default: plugin })
    await settle()

    expect(wrapper.get('main h1').text()).toBe('Acme')
    const nav = wrapper.findAll('nav button').map(button => button.text())
    expect(nav.at(-1)).toBe('Acme')
    expect(wrapper.get('nav [aria-current="page"]').text()).toBe('Acme')
    expect(wrapper.emitted('section')).toBeUndefined()
  })

  it('falls back to Appearance once setup settled without the section', async () => {
    const { wrapper } = mountSettings('acme:removed')
    await settle()

    expect(wrapper.emitted('section')).toEqual([['appearance']])
  })

  it('keeps plugin preferences in the plugin namespace without a project save action', async () => {
    const { wrapper, storage } = mountSettings('acme:prefs')
    await settle()

    await wrapper.get('.acme-toggle').trigger('click')

    expect(storage.getItem('_histoire-ui:https://book.example/:plugin:acme:compact')).toBe('true')
    expect(wrapper.text()).not.toMatch(/save to project/i)
  })
})
