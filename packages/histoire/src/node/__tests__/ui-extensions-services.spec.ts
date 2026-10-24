import type { WorkbenchPluginApi } from '../../../../histoire-plugin-kit/src/index.js'
import { describe, expect, it, vi } from 'vitest'
import { resolveDevEventService } from '../../../../histoire-app/src/app/extensions/dev-events.js'
import { createWorkbenchStorage, getWorkbenchStorageNamespace } from '../../../../histoire-app/src/app/extensions/storage.js'
import { flushMicrotasks } from './utils/flush.js'
import { deferred } from './utils/mcp/deferred.js'
import { memoryStorage } from './utils/settings-storage.js'
import { createTestWorkbenchHost, pluginEntry } from './utils/workbench-extensions.js'

/**
 * Plugin storing one preference value under a shared key name during setup.
 * @param id Plugin id.
 * @param value Stored value.
 */
function preferencePlugin(id: string, value?: string) {
  return pluginEntry({ id, apiVersion: 1, setup(api: WorkbenchPluginApi) {
    if (value !== undefined) api.preferences.set('theme', value)
  } })
}

/**
 * Plugin contributing one item of each navigable kind.
 * @param id Plugin id.
 */
function navigablePlugin(id: string) {
  return pluginEntry({ id, apiVersion: 1, setup(api: WorkbenchPluginApi) {
    const view = { mount: () => {} }
    api.inspector.addTab({ id: 'panel', label: 'Panel', icon: 'view', ...view })
    api.shell.addPane({ id: 'pane', label: 'Pane', icon: 'view', ...view })
  } })
}

describe('workbench extension dev events', () => {
  it('leaves dev events absent and reported unavailable for static books', async () => {
    const window = { __HST_PLUGIN_API__: { sendEvent: vi.fn() } } as unknown as Window
    const devEvents = resolveDevEventService({ mode: 'static', hot: true, window })
    const { workbench } = createTestWorkbenchHost({ mode: 'static', devEvents })

    expect(devEvents).toBeUndefined()
    expect(workbench.context.capabilities.has('devEvents')).toBe(false)
    expect(workbench.context.devEvents).toBeUndefined()
    expect(resolveDevEventService({ mode: 'dev', hot: false, window })).toBeUndefined()
  })

  it('sends dev events through the established global plugin API, installed after the service', async () => {
    const window = {} as Window
    const devEvents = resolveDevEventService({ mode: 'dev', hot: true, window })!
    const { workbench } = createTestWorkbenchHost({ devEvents })
    await expect(workbench.context.devEvents!.send('onPing')).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })

    const sendEvent = vi.fn(async () => 'pong')
    window.__HST_PLUGIN_API__ = { sendEvent, openStory: vi.fn() }

    await expect(workbench.context.devEvents!.send('ping', { value: 1 })).resolves.toBe('pong')
    expect(sendEvent).toHaveBeenCalledWith('ping', { value: 1 })
    expect(workbench.context.capabilities.has('devEvents')).toBe(true)
  })
})

describe('workbench extension preferences', () => {
  it('persists plugin preferences per project without collisions between plugins or projects', async () => {
    const local = memoryStorage()
    const window = { localStorage: local } as unknown as Window
    const storage = createWorkbenchStorage(window)
    const first = getWorkbenchStorageNamespace('http://localhost:6006/books/a/')
    const second = getWorkbenchStorageNamespace('http://localhost:6006/books/b/')
    expect(first).not.toBe(second)

    const writer = createTestWorkbenchHost({ storage, storageNamespace: first, plugins: [preferencePlugin('alpha', 'dark'), preferencePlugin('beta', 'light')] })
    await writer.workbench.host.ready
    await writer.workbench.dispose()

    const values: Record<string, string> = {}
    const read = (scope: string) => pluginEntry({ id: 'alpha', apiVersion: 1, setup(api: WorkbenchPluginApi) {
      values[scope] = api.preferences.get('theme', 'unset')
    } })
    const beta = pluginEntry({ id: 'beta', apiVersion: 1, setup(api: WorkbenchPluginApi) {
      values.beta = api.preferences.get('theme', 'unset')
    } })
    await createTestWorkbenchHost({ storage, storageNamespace: first, plugins: [read('first'), beta] }).workbench.host.ready
    await createTestWorkbenchHost({ storage, storageNamespace: second, plugins: [read('second')] }).workbench.host.ready

    expect(values).toEqual({ first: 'dark', beta: 'light', second: 'unset' })
  })

  it('updates preference subscribers from other tabs and stops listening on dispose', async () => {
    const local = memoryStorage()
    const window = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: memoryStorage() }) as unknown as Window
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const namespace = getWorkbenchStorageNamespace('http://localhost:6006/')
    const received: unknown[] = []
    const { workbench } = createTestWorkbenchHost({ storage: createWorkbenchStorage(window), storageNamespace: namespace, plugins: [pluginEntry({ id: 'alpha', apiVersion: 1, setup(api: WorkbenchPluginApi) {
      api.preferences.subscribe('theme', value => received.push(value))
    } })] })
    await workbench.host.ready
    /** Another tab writes `value` into `area`; browsers then fire `storage` here. */
    const otherTab = (area: Storage, value: string) => {
      area.setItem(`${namespace}:plugin:alpha:theme`, value)
      window.dispatchEvent(Object.assign(new Event('storage'), { key: `${namespace}:plugin:alpha:theme`, storageArea: area }))
    }
    otherTab(window.sessionStorage, '"ignored"')
    otherTab(local, '"dark"')
    expect(received).toEqual(['dark'])

    await workbench.dispose()
    expect(removeListener).toHaveBeenCalledWith('storage', expect.any(Function))
  })
})

describe('workbench extension navigation', () => {
  it('maps built-in targets to existing navigation values', async () => {
    const { workbench, targets, warn } = createTestWorkbenchHost()
    const navigation = workbench.context.navigation
    navigation.openInspectorTab('builtin:props')
    navigation.openInspectorTab('builtin:events')
    navigation.openPane('builtin:search')
    navigation.openSettings('builtin:viewports')
    navigation.openSettings()
    navigation.openCanvasView('builtin:list')
    await navigation.selectStory({ storyId: 'a', variantId: 'b:c' })
    navigation.openInspectorTab('builtin:missing')
    await flushMicrotasks()

    expect(targets.inspectorTab.mock.calls).toEqual([[''], ['events']])
    expect(targets.pane).toHaveBeenCalledWith('search')
    expect(targets.settings.mock.calls).toEqual([['viewports'], []])
    expect(targets.canvasView).toHaveBeenCalledWith('list')
    expect(targets.selectStory).toHaveBeenCalledWith({ storyId: 'a', variantId: 'b:c' })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('waits for plugin setup before resolving plugin targets, then ignores unknown ones', async () => {
    const load = deferred<{ default: unknown }>()
    const entry = navigablePlugin('acme')
    const { workbench, targets, warn } = createTestWorkbenchHost({ plugins: [{ ...entry, load: () => load.promise }] })
    const navigation = workbench.context.navigation
    navigation.openInspectorTab('acme:panel')
    navigation.openPane('acme:pane')
    navigation.openSettings('acme:missing')
    await flushMicrotasks()
    expect(targets.inspectorTab).not.toHaveBeenCalled()

    load.resolve(await entry.load())
    await workbench.host.ready
    await flushMicrotasks()

    expect(targets.inspectorTab).toHaveBeenCalledWith('acme:panel')
    expect(targets.pane).toHaveBeenCalledWith('acme:pane')
    expect(targets.settings).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('acme:missing'))
    navigation.openCanvasView('acme:panel')
    expect(targets.canvasView).not.toHaveBeenCalled()
  })

  it('drops a deferred plugin target superseded by a later navigation', async () => {
    const load = deferred<{ default: unknown }>()
    const entry = navigablePlugin('acme')
    const { workbench, targets } = createTestWorkbenchHost({ plugins: [{ ...entry, load: () => load.promise }] })
    workbench.context.navigation.openInspectorTab('acme:panel')
    workbench.context.navigation.openInspectorTab('builtin:docs')
    load.resolve(await entry.load())
    await workbench.host.ready
    await flushMicrotasks()

    expect(targets.inspectorTab.mock.calls).toEqual([['docs']])
  })
})

describe('workbench plugin installation', () => {
  it('returns before plugin modules load and isolates failing or mismatched entries', async () => {
    const load = deferred<{ default: unknown }>()
    const good = navigablePlugin('good')
    const plugins = [
      { ...good, load: () => load.promise },
      { ...navigablePlugin('broken'), load: async () => { throw new Error('missing module') } },
      { ...navigablePlugin('named'), load: async () => ({ default: { id: 'other', apiVersion: 1, setup: () => {} } }) },
    ]
    const { workbench, error } = createTestWorkbenchHost({ plugins })
    let ready = false
    void workbench.host.ready.then(() => ready = true)
    await flushMicrotasks()
    expect(ready).toBe(false)
    expect(workbench.host.contributions('inspector.tab')).toEqual([])

    load.resolve(await good.load())
    await workbench.host.ready

    expect(workbench.host.contributions('inspector.tab').map(tab => tab.id)).toEqual(['good:panel'])
    expect(workbench.host.diagnostics().map(entry => entry.pluginId)).toEqual(['broken', 'named'])
    // Failures are reported once each, attributed, instead of leaving a plugin silently missing.
    expect(error.mock.calls.map(([message]) => message)).toEqual(['[histoire plugin "broken"] setup failed:', '[histoire plugin "named"] setup failed:'])
  })
})
