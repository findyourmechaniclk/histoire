import type { ExtensionHost, ExtensionHostServices, FrameScopedContext, WorkbenchPluginApi } from '@histoire/plugin-kit'
import { createExtensionHost, createSessionContext, defineWorkbenchPlugin } from '@histoire/plugin-kit'
import { createHistoireSessionWithAdapters } from '@histoire/sdk/internal'
import { onTestFinished, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { sourceFixture } from '../../../../histoire-sdk/src/__tests__/fixtures/session.js'

/**
 * Connected SDK session over the shared source fixture, selected on `a:b`/`c`, disposed after
 * the test.
 * @param sourceId Distinct source identity for multi-book pages.
 */
export async function connectedSession(sourceId?: string) {
  const fixture = sourceFixture()
  if (sourceId) fixture.descriptor.sourceId = sourceId
  const session = createHistoireSessionWithAdapters({ url: `https://${sourceId ?? 'book'}.example/` }, fixture.adapters)
  await session.connect()
  await session.selection.select({ storyId: 'a:b', variantId: 'c' })
  onTestFinished(() => session.dispose())
  return { session, fixture }
}

/** Vue section view naming its tab position and the variant it received. */
export const SectionProbe = defineComponent({
  props: { context: { type: Object, required: true } },
  setup: props => () => h('p', { class: 'section-probe' }, `section:${(props.context as FrameScopedContext).frame.target.variantId}`),
})

/** Spies of the probe plugin's DOM tab view and action. */
export interface ProbeSpies {
  /** Tab view mounts. */
  mounts: ReturnType<typeof vi.fn>
  /** Tab view disposals. */
  disposals: ReturnType<typeof vi.fn>
  /** Action runs with the context received. */
  runs: ReturnType<typeof vi.fn>
  /** Plugin teardown. */
  teardown: ReturnType<typeof vi.fn>
}

/**
 * Plugin registering one inspector tab (DOM mount), a section after Props, a toolbar action and
 * a command with a global shortcut. Extra registrations come from `extra`.
 * @param id Plugin id; also the tab label.
 * @param extra Additional setup.
 */
export function probePlugin(id: string, extra?: (api: WorkbenchPluginApi) => void) {
  const spies: ProbeSpies = { mounts: vi.fn(), disposals: vi.fn(), runs: vi.fn(), teardown: vi.fn() }
  const definition = defineWorkbenchPlugin({ id, apiVersion: 1, setup(api) {
    api.inspector.addTab({ id: 'panel', label: id, icon: 'plug', mount(container, context) {
      spies.mounts(context.frame.target)
      container.textContent = `${id}:${context.frame.target.variantId}`
      return { update: next => void (container.textContent = `${id}:${next.frame.target.variantId}`), dispose: spies.disposals }
    } })
    api.inspector.addSection({ id: 'after', tab: 'builtin:props', position: 'after', component: SectionProbe })
    api.toolbar.addItem({ id: 'ping', group: 'plugins', type: 'action', label: `${id} ping`, icon: 'play', run: context => void spies.runs(context) })
    api.commands.add({ id: 'run', label: `${id} run`, icon: 'play', run: context => void spies.runs(context) })
    extra?.(api)
    return spies.teardown
  } })
  return { definition, spies }
}

/**
 * Caller-owned host over `session` built the documented way, disposed after the test.
 * @param session Session the plugins' root context reads.
 * @param plugins Plugin definitions.
 * @param services Extra host services (storage).
 */
export async function nativeHost(session: Parameters<typeof createSessionContext>[0]['session'], plugins: Parameters<typeof createExtensionHost>[0]['plugins'], services: Partial<ExtensionHostServices> = {}): Promise<ExtensionHost> {
  const root = createSessionContext({ session })
  const host = createExtensionHost({ plugins, services: { context: root.context, ...services } })
  onTestFinished(async () => {
    await host.dispose()
    root.close()
  })
  await host.ready
  return host
}

/**
 * Visible tab labels of the first tab list under `element`.
 * @param element Wrapper element.
 */
export function tabLabels(element: Element): string[] {
  return Array.from(element.querySelectorAll('[role=tab]'), tab => tab.textContent?.trim() ?? '')
}

/**
 * Presses a key combination inside `target` (bubbling, cancelable keydown).
 * @param target Event target.
 * @param init Key and modifiers.
 */
export function press(target: Element, init: KeyboardEventInit) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
}
