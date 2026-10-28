import type { HistoireConfig } from '@histoire/shared'
import { validateEmbedOrigins } from '@histoire/protocol'

/** Disabled by default; validate source-owned policy before publishing capabilities. */
export function resolveInspectionConfig(value?: HistoireConfig['inspection']) {
  if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) throw new Error('Expected inspection configuration object')
  const input = value ?? { enabled: false }
  if (Object.keys(input).some(key => !['enabled', 'diagnostics', 'components', 'accessibility', 'allowedOrigins'].includes(key))) throw new Error('Unknown inspection configuration field')
  for (const key of ['enabled', 'diagnostics', 'components', 'accessibility'] as const) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error(`Expected inspection.${key} boolean`)
  }
  return { enabled: input.enabled ?? false, diagnostics: input.diagnostics ?? false, components: input.components ?? false, accessibility: input.accessibility ?? false, allowedOrigins: validateEmbedOrigins(input.allowedOrigins ?? []) }
}
