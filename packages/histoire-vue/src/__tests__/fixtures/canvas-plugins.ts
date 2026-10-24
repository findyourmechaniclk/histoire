import type { vi } from 'vitest'
import type { ContextSession } from '../../../../histoire-app/src/app/extensions/context.js'
import type { WorkbenchHost } from '../../../../histoire-app/src/app/extensions/create-workbench-host.js'
import type { WorkbenchPluginApi } from '../../../../histoire-plugin-kit/src/index.js'
import type { CanvasLifetimeExtras } from './canvas-lifetime.js'
import { useHistoireSession } from '@histoire/vue'
import { flushPromises } from '@vue/test-utils'
import { onTestFinished } from 'vitest'
import { provideExtensionHost } from '../../../../histoire-app/src/app/composables/extensions.js'
import { createShortcutRegistry, provideShortcutRegistry } from '../../../../histoire-app/src/app/util/shortcuts.js'
import { defineWorkbenchPlugin } from '../../../../histoire-plugin-kit/src/index.js'
import { createTestWorkbenchHost, pluginEntry } from '../../../../histoire/src/node/__tests__/utils/workbench-extensions.js'
import { canvasLifetimeFixture } from './canvas-lifetime.js'

/**
 * Mount a real canvas viewport inside a workbench whose extension host installs one `acme`
 * plugin (frame module installed too), with the workbench shortcut registry provided.
 * Resolves after plugins settled, unless `gate` keeps the plugin import pending.
 * @param create Mocked replica factory (see `canvasLifetimeFixture`).
 * @param setup Plugin setup registering canvas contributions.
 * @param options Fixture options.
 * @param options.budget Viewport frame budget.
 * @param options.preferences Saved canvas preferences.
 * @param options.gate Plugin import waits for it; the fixture then resolves without awaiting setup.
 */
export async function canvasPluginFixture(create: ReturnType<typeof vi.fn>, setup: (api: WorkbenchPluginApi) => void, options: { budget?: number, preferences?: CanvasLifetimeExtras['preferences'], gate?: Promise<unknown> } = {}) {
  let workbench!: WorkbenchHost
  let targets!: ReturnType<typeof createTestWorkbenchHost>['targets']
  const shortcuts = createShortcutRegistry()
  const test = await canvasLifetimeFixture(create, options.budget ?? 3, 2, 0.5, false, {
    preferences: options.preferences,
    setup() {
      const plugin = defineWorkbenchPlugin({ id: 'acme', apiVersion: 1, setup })
      const created = createTestWorkbenchHost({ session: useHistoireSession() as ContextSession, plugins: [pluginEntry(plugin, options.gate && (() => options.gate!.then(() => ({ default: plugin }))))], framePlugins: () => [{ id: 'acme', apiVersion: 1 }] })
      workbench = created.workbench
      targets = created.targets
      provideExtensionHost(workbench)
      provideShortcutRegistry(shortcuts)
    },
  })
  onTestFinished(() => workbench.dispose())
  if (!options.gate) await workbench.host.ready
  await flushPromises()
  return { ...test, workbench, targets, shortcuts }
}
