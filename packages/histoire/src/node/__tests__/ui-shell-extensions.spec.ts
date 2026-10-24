// @vitest-environment jsdom
import type { WorkbenchPluginApi } from '../../../../histoire-plugin-kit/src/index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveContributionIcon } from '../../../../histoire-app/src/app/extensions/icons.js'
import { createContributionLookup } from '../../../../histoire-app/src/app/extensions/shell-registry.js'
import { createStandaloneNavigation } from '../../../../histoire-app/src/app/standalone/navigation.js'
import { createStandaloneSelection } from '../../../../histoire-app/src/app/standalone/selection.js'
import { createHistoireSessionWithAdapters } from '../../../../histoire-sdk/dist/internal.js'
import { sourceFixture } from '../../../../histoire-sdk/src/__tests__/fixtures/session.js'
import { deferred } from './utils/mcp/deferred.js'
import { createTestWorkbenchHost, pluginEntry } from './utils/workbench-extensions.js'

const resources: (() => Promise<void> | void)[] = []

afterEach(async () => {
  await Promise.all(resources.splice(0).reverse().map(close => close()))
  window.history.replaceState({}, '', '/')
})

/** Plugin contributing one settings section. */
const plugin = { id: 'acme', apiVersion: 1 as const, setup(api: WorkbenchPluginApi) {
  api.settings.addSection({ id: 'prefs', label: 'Acme', icon: 'settings', mount: () => {} })
} }

/**
 * Standalone router whose settings guard reads the given host's sections lazily.
 * @param load Optional pending plugin import.
 */
async function settingsRouter(load?: () => Promise<{ default: unknown }>) {
  const session = createHistoireSessionWithAdapters({ url: window.location.href }, sourceFixture().adapters)
  await session.connect()
  const selection = createStandaloneSelection(session)
  const navigation = createStandaloneNavigation(selection, { base: '/', mode: 'history', error: vi.fn(), dev: true })
  const { workbench } = createTestWorkbenchHost({ plugins: [pluginEntry(plugin, load)] })
  resources.push(navigation.close, selection.close, () => session.dispose(), () => workbench.dispose())
  const unbind = navigation.bindSettingsSections(createContributionLookup(workbench, 'settings.section'))
  /** Navigates to one settings section and returns the resulting section. */
  async function open(section: string): Promise<unknown> {
    await navigation.router.push({ name: 'settings', params: { section } })
    return navigation.router.currentRoute.value.params.section
  }
  return { open, workbench, unbind }
}

describe('plugin settings route guard', () => {
  it('keeps plugin sections pending until setup settles, then rejects unknown ones', async () => {
    const load = deferred<{ default: unknown }>()
    const { open, workbench } = await settingsRouter(() => load.promise)

    expect(await open('acme:prefs')).toBe('acme:prefs')
    expect(await open('acme:removed')).toBe('acme:removed')
    expect(await open('acme')).toBe('appearance')

    load.resolve({ default: plugin })
    await workbench.host.ready
    expect(await open('acme:prefs')).toBe('acme:prefs')
    expect(await open('acme:removed')).toBe('appearance')
  })

  it('lets plugin sections through while no host is bound, as on an initial deep link', async () => {
    const { open, workbench, unbind } = await settingsRouter()
    await workbench.host.ready
    unbind()

    expect(await open('acme:later')).toBe('acme:later')
  })
})

describe('contribution icons', () => {
  it('accepts bundled glyph names and replaces unknown ones once with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const contribution = { id: 'acme:pane', icon: 'not-a-glyph' }

    expect(resolveContributionIcon({ id: 'acme:ok', icon: 'document' })).toBe('document')
    expect(resolveContributionIcon(contribution)).toBe('plug')
    expect(resolveContributionIcon(contribution)).toBe('plug')
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('acme:pane')
    warn.mockRestore()
  })
})
