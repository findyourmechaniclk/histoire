import { createRequire } from 'node:module'
import { dirname } from 'pathe'

/** Resolve app entries from Histoire's dependencies, not a virtual module's user root. */
const require = createRequire(import.meta.url)

/**
 * Virtual modules have no filesystem owner. Resolve their app dependency from
 * Histoire so consumers only need to install `histoire`, regardless of layout.
 * @param entry Public app entry: `api` (the package root) or `sandbox`.
 */
export function resolveHistoireAppEntry(entry: 'api' | 'sandbox') {
  return require.resolve(entry === 'api' ? '@histoire/app' : '@histoire/app/sandbox')
}

/**
 * Directory of the bundled app build: its entries (`index.js`, `sandbox.js`,
 * `controls.js`, ...) and their shared chunks.
 */
export function resolveHistoireAppBundledDir() {
  return dirname(resolveHistoireAppEntry('sandbox'))
}
