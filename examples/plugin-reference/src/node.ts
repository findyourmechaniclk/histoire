// Node entry: loaded from `histoire.config.*`. Only `workbench` reaches the browser.
import type { Plugin } from 'histoire'
import { fileURLToPath } from 'node:url'
import { DEFAULT_REFERENCE_OPTIONS, REFERENCE_PLUGIN_ID } from './options.js'

/** Workbench UI variants shipped by this package; all register the same contributions. */
export const REFERENCE_UI_VARIANTS = ['vue', 'dom', 'react', 'svelte', 'svelte4'] as const

/**
 * One UI variant: workbench Vue SFCs, plain DOM, React, Svelte 5 or Svelte 4 views. Svelte
 * variants use the project's `svelte` runtime: `svelte` needs Svelte 5, `svelte4` Svelte 4.
 */
export type ReferenceUi = typeof REFERENCE_UI_VARIANTS[number]

/** Options of {@link referencePlugin}. */
export interface ReferencePluginOptions {
  /** Workbench view implementation. Defaults to `dom`. */
  ui?: ReferenceUi
  /** Smallest interactive target size in CSS pixels before the audit reports it. Defaults to 24. */
  minTargetSize?: number
  /** Leave the plugin out of static builds. */
  devOnly?: boolean
}

/**
 * Resolves a file shipped next to this module. Package authors resolve their own relative
 * entries; Histoire treats remaining relative paths as project-root relative.
 * @param path Path relative to this file.
 */
function entry(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

/**
 * Reference workbench plugin: audits rendered variants inside story frames and shows the
 * results on every workbench surface.
 * @param options Plugin options.
 */
export function referencePlugin(options: ReferencePluginOptions = {}): Plugin {
  const ui = options.ui ?? 'dom'
  if (!REFERENCE_UI_VARIANTS.includes(ui)) {
    throw new Error(`[histoire-example-plugin-reference] unknown ui "${ui}"; expected one of ${REFERENCE_UI_VARIANTS.join(', ')}`)
  }
  return {
    name: 'histoire-example-plugin-reference',
    workbench: {
      id: REFERENCE_PLUGIN_ID,
      apiVersion: 1,
      client: entry(`./client/${ui}.js`),
      frame: entry('./frame.js'),
      // Explicit JSON options are the only plugin data the browser sees.
      options: { minTargetSize: options.minTargetSize ?? DEFAULT_REFERENCE_OPTIONS.minTargetSize },
      devOnly: options.devOnly,
    },
  }
}
