import type { HistoireInspectionCapabilities } from '../types/inspection.js'
import { measureWireValue } from '../bridge/size.js'
import { invalid, wireRecord } from '../bridge/validation.js'
import { validateEmbedOrigins } from '../url/embed-origins.js'

/** Source extension names remain separate from strict legacy capabilities. */
export const HISTOIRE_INSPECTION_CAPABILITIES = ['variant', 'dom', 'components', 'componentDetails', 'accessibilityAudit', 'highlight', 'componentHighlight', 'pick', 'highlightLease', 'diagnostics'] as const
/** Explicit operation-to-capability mapping; names need not be interchangeable. */
export const HISTOIRE_INSPECTION_OPERATION_CAPABILITIES = {
  variant: 'variant',
  dom: 'dom',
  components: 'components',
  component: 'componentDetails',
  componentForElement: 'componentDetails',
  accessibility: 'accessibilityAudit',
  highlight: 'highlight',
  pick: 'pick',
  highlightLease: 'highlightLease',
  highlightClear: 'highlightLease',
  debug: 'diagnostics',
} as const
/** Validate every optional capability before projecting it to callers. */
export function validateInspectionCapabilities(value: unknown): HistoireInspectionCapabilities {
  measureWireValue(value, { maxBytes: 4096 })
  const input = wireRecord(value)
  for (const [key, value] of Object.entries(input)) {
    if (!(HISTOIRE_INSPECTION_CAPABILITIES as readonly string[]).includes(key)) invalid('Unknown inspection capability')
    const capability = wireRecord(value)
    if (Object.keys(capability).some(key => !['available', 'reason'].includes(key)) || typeof capability.available !== 'boolean' || (capability.reason !== undefined && (typeof capability.reason !== 'string' || capability.reason.length > 128))) invalid('Invalid inspection capability')
  }
  return input as HistoireInspectionCapabilities
}
/** Absence and explicit false always deny; descriptors are only upper bounds. */
export function hasInspectionCapability(value: HistoireInspectionCapabilities | undefined, key: keyof HistoireInspectionCapabilities): boolean {
  return value?.[key]?.available === true
}
/** Validate source-owned exact-origin policy, independently of legacy embed keys. */
export function validateInspectionPolicy(value: unknown): void {
  measureWireValue(value, { maxBytes: 4096 })
  const policy = wireRecord(value)
  if (Object.keys(policy).some(key => key !== 'allowedOrigins')) invalid('Unknown inspection policy')
  validateEmbedOrigins(policy.allowedOrigins)
}
