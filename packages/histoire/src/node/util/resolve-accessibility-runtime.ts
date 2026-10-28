import type { HistoireConfig } from '@histoire/shared'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createAxeEngineModule } from '../virtual/axe-engine.js'
import { resolveBrowserRuntimeEntry } from './resolve-browser-runtime.js'

const require = createRequire(import.meta.url)

/** Resolve the optional engine without fetching or installing dependencies. */
function resolveAxe(root: string): string | null {
  try {
    return require.resolve('axe-core', { paths: [root] })
  }
  catch {
    try {
      return require.resolve('axe-core')
    }
    catch { return null }
  }
}

/** Return only locally available modules for an explicitly enabled audit. */
export function resolveAccessibilityRuntime(root: string, config?: HistoireConfig['inspection'], resolveEngine = resolveAxe): { scannerId: string, axeId: string } | undefined {
  if (config?.enabled !== true || config.accessibility !== true) return undefined
  const axeId = resolveEngine(root)
  if (!axeId) return undefined
  try {
    createAxeEngineModule(readFileSync(axeId, 'utf8'))
    return { scannerId: resolveBrowserRuntimeEntry('accessibility'), axeId }
  }
  catch { return undefined }
}
