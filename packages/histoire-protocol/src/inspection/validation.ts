import type { HistoireInspectionOwner, HistoireInspectionResult } from '../types/inspection.js'
import { measureWireValue } from '../bridge/size.js'
import { invalid, wireId, wireRecord } from '../bridge/validation.js'
import { HistoireSdkError } from '../types/error.js'
import { validateAccessibilityExtension, validateComponentExtension } from './extensions.js'
import { validateInspectionComponents, validateInspectionNodes } from './rows.js'

/** Shared response budget leaves room for transport metadata. */
export const HISTOIRE_INSPECTION_LIMITS = { result: 60 * 1024, nodes: 500, depth: 20, selector: 512, pending: 4, timeout: 5000 } as const
/** Reject extension fields rather than silently granting new behavior. */
function keys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid('Unknown inspection field')
}
/** An inspection target always names a rendered variant. */
export function validateInspectionTarget(value: unknown): HistoireInspectionOwner['target'] {
  measureWireValue(value, { maxBytes: 16 * 1024, maxDepth: 32 })
  const input = wireRecord(value)
  keys(input, ['storyId', 'variantId'])
  if (!wireId(input.storyId) || !wireId(input.variantId)) invalid('Exact inspection target required')
  return input as HistoireInspectionOwner['target']
}
/** Validate the entire tuple; caller-provided IDs never grant access. */
export function validateInspectionOwner(value: unknown): HistoireInspectionOwner {
  measureWireValue(value, { maxBytes: 16 * 1024, maxDepth: 32 })
  const input = wireRecord(value)
  keys(input, ['sourceId', 'epoch', 'revision', 'runtimeId', 'target'])
  for (const key of ['sourceId', 'epoch', 'revision', 'runtimeId']) {
    if (!wireId(input[key])) invalid('Invalid inspection owner')
  }
  validateInspectionTarget(input.target)
  return input as unknown as HistoireInspectionOwner
}
/** Compare structured IDs without ambiguous string concatenation. */
export function sameInspectionOwner(a: HistoireInspectionOwner, b: HistoireInspectionOwner): boolean {
  return a.sourceId === b.sourceId && a.epoch === b.epoch && a.revision === b.revision && a.runtimeId === b.runtimeId
    && a.target.storyId === b.target.storyId && a.target.variantId === b.target.variantId
}
/** Validate finite wire inputs. AbortSignal is intentionally absent. */
export function validateInspectionInput(kind: string, value: unknown): Record<string, unknown> {
  measureWireValue(value, { maxBytes: 16 * 1024, maxDepth: 32 })
  const input = wireRecord(value)
  const common = ['target', 'expectedOwner', 'correlationId']
  const fields: Record<string, string[]> = { debug: ['action', 'observationId', 'afterSequence'], variant: [], dom: ['selector', 'maxNodes', 'maxDepth'], components: ['rootId', 'maxNodes', 'maxDepth'], component: ['componentId'], componentForElement: ['selector'], accessibility: ['selector'], highlight: ['selector', 'componentId', 'durationMs'], pick: ['x', 'y'], highlightLease: ['selector', 'componentId', 'durationMs'], highlightClear: ['leaseId'] }
  if (!Object.hasOwn(fields, kind)) invalid('Unknown inspection operation')
  keys(input, [...common, ...fields[kind]])
  if (input.target !== undefined) validateInspectionTarget(input.target)
  if (input.expectedOwner !== undefined) validateInspectionOwner(input.expectedOwner)
  for (const key of ['selector', 'componentId', 'rootId', 'correlationId']) {
    if (input[key] !== undefined && (typeof input[key] !== 'string' || !input[key] || (input[key] as string).length > (key === 'selector' ? 512 : 128))) invalid('Invalid inspection locator or correlation')
  }
  for (const [key, minimum, maximum] of [['maxNodes', 1, 500], ['maxDepth', 0, 20], ['durationMs', 1, 5000]] as const) {
    if (input[key] !== undefined && (!Number.isInteger(input[key]) || (input[key] as number) < minimum || (input[key] as number) > maximum)) invalid('Invalid inspection bound')
  }
  if (kind === 'debug' && (!['start', 'read', 'stop'].includes(input.action as string) || !wireId(input.observationId) || (input.afterSequence !== undefined && (!Number.isSafeInteger(input.afterSequence) || (input.afterSequence as number) < 0)))) invalid('Invalid diagnostic observation')
  if ((kind === 'highlight' || kind === 'highlightLease') && Number(input.selector !== undefined) + Number(input.componentId !== undefined) !== 1) invalid('One highlight locator required')
  if (kind === 'component' && input.componentId === undefined) invalid('Component identity required')
  if (kind === 'componentForElement' && input.selector === undefined) invalid('Component selector required')
  if (kind === 'highlightClear' && (typeof input.leaseId !== 'string' || !input.leaseId || input.leaseId.length > 128 || input.expectedOwner === undefined || input.target === undefined)) invalid('Invalid highlight lease')
  if (kind === 'pick' && (['x', 'y'].some(key => typeof input[key] !== 'number' || !Number.isFinite(input[key]) || Math.abs(input[key] as number) > 1_000_000))) invalid('Invalid inspection point')
  measureWireValue(input, { maxBytes: 16 * 1024 })
  return input
}
/** Strict JSON validation avoids coercing callbacks, unsupported values or accessors. */
export function assertInspectionJson(value: unknown, ancestors = new Set<object>()): void {
  if (ancestors.size === 0) measureWireValue(value, { maxBytes: HISTOIRE_INSPECTION_LIMITS.result, maxDepth: 32 })
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return
  if (!value || typeof value !== 'object' || ancestors.has(value)) invalid('Inspection requires acyclic JSON')
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) invalid('Inspection requires plain JSON objects')
  ancestors.add(value)
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === 'length') continue
    if (!('value' in descriptor) || ['__proto__', 'constructor', 'prototype'].includes(key)) invalid('Unsafe inspection field')
    assertInspectionJson(descriptor.value, ancestors)
  }
  ancestors.delete(value)
}
/** Validate detached read result before exposing it outside the owning runtime. */
export function validateInspectionResult(value: unknown): HistoireInspectionResult {
  measureWireValue(value, { maxBytes: HISTOIRE_INSPECTION_LIMITS.result, maxDepth: 32 })
  assertInspectionJson(value)
  const input = wireRecord(value)
  const base = ['mode', 'owner', 'observedAt', 'durationMs', 'truncated', 'inspection']
  if (!['live', 'isolated'].includes(input.mode as string) || typeof input.observedAt !== 'string' || !Number.isFinite(Date.parse(input.observedAt)) || typeof input.durationMs !== 'number' || !Number.isFinite(input.durationMs) || input.durationMs < 0 || typeof input.truncated !== 'boolean') invalid('Invalid inspection metadata')
  validateInspectionOwner(input.owner)
  if (input.inspection === 'variant') {
    keys(input, [...base, 'state', 'components', 'propsAvailable', 'omittedValues'])
    wireRecord(input.state)
    validateInspectionComponents(input.components)
    if (!Array.isArray(input.components) || input.components.length > 100 || typeof input.propsAvailable !== 'boolean' || !Number.isSafeInteger(input.omittedValues) || (input.omittedValues as number) < 0) invalid('Invalid variant inspection')
  }
  else if (input.inspection === 'dom') {
    keys(input, [...base, 'matched', 'nodes'])
    validateInspectionNodes(input.nodes)
    if (typeof input.matched !== 'boolean' || !Array.isArray(input.nodes) || input.nodes.length > 500 || (!input.matched && input.nodes.length > 0)) invalid('Invalid DOM inspection')
  }
  else if (input.inspection === 'components' || input.inspection === 'component' || input.inspection === 'componentForElement') {
    validateComponentExtension(input, base)
  }
  else if (input.inspection === 'accessibility') {
    validateAccessibilityExtension(input, base)
  }
  else if (input.inspection === 'debug') {
    keys(input, [...base, 'items', 'nextSequence', 'oldestSequence', 'droppedCount', 'gap'])
    if (!Array.isArray(input.items) || input.items.length > 200 || !Number.isSafeInteger(input.nextSequence) || (input.nextSequence as number) < 0 || !Number.isSafeInteger(input.droppedCount) || (input.droppedCount as number) < 0) invalid('Invalid diagnostic page')
    if (!Number.isSafeInteger(input.oldestSequence) || (input.oldestSequence as number) < 1 || typeof input.gap !== 'boolean') invalid('Invalid diagnostic cursor')
    let previous = 0
    for (const value of input.items) {
      const row = wireRecord(value)
      keys(row, ['sequence', 'timestamp', 'kind', 'message', 'level', 'owner', 'correlationId', 'monotonicTimeMs', 'requestId', 'operationId', 'outcome', 'details'])
      if (!Number.isSafeInteger(row.sequence) || (row.sequence as number) < 1 || typeof row.timestamp !== 'number' || !Number.isFinite(row.timestamp) || !['console', 'page-error', 'unhandled-rejection', 'sdk-request', 'component-event', 'state-patch', 'lifecycle'].includes(row.kind as string) || typeof row.message !== 'string' || row.message.length > 2048) invalid('Invalid diagnostic entry')
      if (typeof row.monotonicTimeMs !== 'number' || !Number.isFinite(row.monotonicTimeMs) || row.monotonicTimeMs < 0 || (row.sequence as number) <= previous || (row.sequence as number) > (input.nextSequence as number) || (row.sequence as number) < (input.oldestSequence as number)) invalid('Invalid diagnostic chronology')
      previous = row.sequence as number
      measureWireValue(row, { maxBytes: 4096 })
      if (row.owner === undefined && row.kind !== 'lifecycle') invalid('Runtime diagnostics require owner')
      if (row.owner !== undefined) validateInspectionOwner(row.owner)
      for (const key of ['level', 'correlationId', 'requestId', 'operationId', 'outcome']) {
        if (row[key] !== undefined && (typeof row[key] !== 'string' || (row[key] as string).length > 128)) invalid('Invalid diagnostic label')
      }
    }
  }
  else {
    throw new HistoireSdkError('INVALID_ARGUMENT', 'Unknown inspection result')
  }
  return input as unknown as HistoireInspectionResult
}
