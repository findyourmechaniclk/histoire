import type { App, InjectionKey } from 'vue'
import type { WorkbenchHost } from '../extensions/create-workbench-host.js'
import type { WorkbenchPluginEntry } from '../extensions/plugins.js'
import { inject, provide } from 'vue'

/** Extension host of the nearest workbench; nested selected-frame providers reuse it. */
const extensionHostKey: InjectionKey<WorkbenchHost> = Symbol('histoire-extension-host')

/** Configured plugin entries handed from the standalone bootstrap to the workbench. */
const workbenchPluginsKey: InjectionKey<readonly WorkbenchPluginEntry[]> = Symbol('histoire-workbench-plugins')

/**
 * Provides the workbench extension host to descendants.
 * @param host Host owned by the calling workbench.
 */
export function provideExtensionHost(host: WorkbenchHost): void {
  provide(extensionHostKey, host)
}

/**
 * Extension host of the nearest workbench: registry, scoped contexts and action runner.
 * @throws {Error} Outside a workbench.
 */
export function useExtensionHost(): WorkbenchHost {
  const host = inject(extensionHostKey, null)
  if (!host) throw new Error('Histoire workbench extension host is required')
  return host
}

/**
 * Extension host of the nearest workbench, or `undefined` for parts mounted without one
 * (native hosts that do not provide a host, isolated tests).
 */
export function useOptionalExtensionHost(): WorkbenchHost | undefined {
  return inject(extensionHostKey, undefined)
}

/**
 * Hands configured plugin entries to every workbench of `app`.
 * @param app Standalone application.
 * @param entries Manifest entries in config order.
 */
export function provideWorkbenchPlugins(app: App, entries: readonly WorkbenchPluginEntry[]): void {
  app.provide(workbenchPluginsKey, entries)
}

/** Configured plugin entries; empty when the bootstrap provided none. */
export function injectWorkbenchPlugins(): readonly WorkbenchPluginEntry[] {
  return inject(workbenchPluginsKey, [])
}
