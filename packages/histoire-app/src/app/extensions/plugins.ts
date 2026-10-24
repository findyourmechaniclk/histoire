import type { WorkbenchPluginManifestEntry } from '@histoire/plugin-kit'

/** One configured `workbench.client` entry, as `virtual:$histoire-workbench-plugins` exports it. */
export type WorkbenchPluginEntry = WorkbenchPluginManifestEntry

// Shared with the source-origin explorer document: lazy entries, import inside setup.
export { lazyWorkbenchPlugins as toExtensionHostPlugins } from '@histoire/plugin-kit'
