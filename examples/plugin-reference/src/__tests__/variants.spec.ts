// @vitest-environment jsdom
import type { ContributionKind, ExtensionHost, FrameScopedContext, PluginChannel, PluginFrameService, WorkbenchContext, WorkbenchPluginDefinition } from '@histoire/plugin-kit'
import type { AuditReport } from '../domain/audit.js'
import { createExtensionHost, PLUGIN_FRAMES_SERVICE } from '@histoire/plugin-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import domPlugin from '../client/dom.js'
import reactPlugin from '../client/react.js'
import svelte4Plugin from '../client/svelte4.js'
import sveltePlugin from '../client/svelte.js'
import vuePlugin from '../client/vue.js'

const KINDS: ContributionKind[] = ['inspector.tab', 'inspector.section', 'toolbar.item', 'command', 'shortcut', 'frame-menu.item', 'context-menu.item', 'canvas.overlay', 'canvas.frame-overlay', 'canvas.tool', 'canvas.view', 'shell.pane', 'settings.section', 'home.section']
const TARGET = { storyId: 'button', variantId: 'primary' }
const REPORT: AuditReport = { nodes: 3, issues: [{ rule: 'missing-alt', element: 'img', message: 'Image without alt text' }] }

/**
 * Frame service with one attached actor answering `audit` with {@link REPORT}, like the frame
 * module does; records highlight requests.
 */
function frameService() {
  const highlights: unknown[] = []
  const service: PluginFrameService = {
    list: () => [{ key: 'frame-1', target: TARGET, actorId: 'actor-1' }],
    open() {
      const listeners = new Map<string, (data: any, message: any) => void>()
      const channel: PluginChannel = {
        async post(type, data) {
          if (type === 'audit') queueMicrotask(() => listeners.get('report')?.(REPORT, { type: 'report', data: REPORT }))
          if (type === 'highlight') highlights.push(data)
        },
        on(type, listener) {
          listeners.set(type, listener)
          return () => listeners.delete(type)
        },
        getDroppedCount: () => 0,
      }
      return channel
    },
    onError: () => () => {},
    subscribe: () => () => {},
  }
  return { service, highlights }
}

/**
 * Root context with inert services plus the frame service.
 * @param frames Frame service exposed under plugin-kit's key.
 */
function rootContext(frames: PluginFrameService): WorkbenchContext {
  return Object.assign({
    capabilities: new Set(['frames'] as const),
    source: { mode: 'dev' as const },
    catalog: { list: async () => [], getStory: async () => { throw new Error('none') }, search: async () => [] },
    selection: { target: TARGET },
    navigation: { selectStory: vi.fn(async () => {}), openInspectorTab: vi.fn(), openPane: vi.fn(), openSettings: vi.fn(), openCanvasView: vi.fn() },
    subscribe: () => () => {},
  }, { [PLUGIN_FRAMES_SERVICE]: frames })
}

const hosts: ExtensionHost[] = []
afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.dispose()))
  document.body.replaceChildren()
})

/**
 * Installs one variant in a fresh host.
 * @param definition Workbench plugin definition of the variant.
 */
async function install(definition: WorkbenchPluginDefinition) {
  const frames = frameService()
  const context = rootContext(frames.service)
  const host = createExtensionHost({ plugins: [{ definition, options: { minTargetSize: 32 } }], services: { context } })
  hosts.push(host)
  await host.ready
  return { host, context, frames }
}

describe('reference plugin UI variants', () => {
  it('register every contribution kind with identical ids', async () => {
    const ids = new Set<string>()
    for (const definition of [vuePlugin, domPlugin, reactPlugin, sveltePlugin, svelte4Plugin]) {
      const { host } = await install(definition)
      expect(host.diagnostics()).toEqual([])
      for (const kind of KINDS) expect(host.contributions(kind).length, kind).toBeGreaterThan(0)
      ids.add(JSON.stringify(KINDS.flatMap(kind => host.contributions(kind).map(item => item.id))))
    }
    expect(ids.size).toBe(1)
  })

  it.each([['dom', domPlugin], ['react', reactPlugin], ['svelte', sveltePlugin], ['svelte4', svelte4Plugin]] as const)('%s views render frame reports and preferences', async (_, definition) => {
    const { host, context, frames } = await install(definition)
    const frame: FrameScopedContext = { ...context, frame: { key: 'frame-1', target: TARGET }, runtime: { getSnapshot: () => ({}) as any, subscribe: () => () => {} } }
    const mount = async (id: string, scope: unknown) => {
      const container = document.body.appendChild(document.createElement('div'))
      await host.mount(id, container, scope).ready
      return container
    }

    const tab = await mount('reference:audit', frame)
    await vi.waitFor(() => expect(tab.textContent).toContain('1 issue · 3 elements'))
    expect(host.contributions('inspector.tab')[0].badge?.(frame)).toBe(1)
    // A new report invalidates the plugin, so surfaces re-read the tab badge.
    const invalidated = vi.fn()
    host.subscribe(invalidated)
    await host.run('reference:run', context)
    await vi.waitFor(() => expect(invalidated).toHaveBeenCalled())
    tab.querySelector<HTMLElement>('.hst-ref-item')!.click()
    expect(frames.highlights).toEqual([{ index: 0 }])

    const settings = await mount('reference:settings', context)
    expect(settings.textContent).toContain('Minimum target size: 32 px')
    const toggle = settings.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    expect(toggle.checked).toBe(true)
    toggle.click()
    expect(await host.run('reference:badges', context).then(() => 'toggled')).toBe('toggled')
    // The settings switch and the toolbar toggle both write the same preference.
    const pressed = host.contributions('toolbar.item').find(item => item.id === 'reference:badges') as { pressed: (context: WorkbenchContext) => boolean }
    expect(pressed.pressed(context)).toBe(true)
  })
})
