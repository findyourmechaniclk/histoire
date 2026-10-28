import type { HistoireIsolatedInspectionInput } from '@histoire/protocol'
import type { HistoireProjectInspection, HistoireProjectInspectionOptions } from './inspection-types.js'
import type { ProjectServices } from './internal.js'
import { HistoireSdkError, measureWireValue, validateInspectionResult } from '@histoire/protocol'
import { createAccessibilityTask } from '../runtime/inspection/accessibility-task.js'
import { createInspectionTask } from '../runtime/inspection/task.js'
import { acquireCaptureSource } from './capture-source.js'
import { toSdkExecutionError } from './execution.js'
import { awaitInspectionExecution } from './inspection-execution.js'
import { createProjectInspectionResult } from './inspection-result.js'

/** Public names intentionally distinguish ARIA structure from compliance auditing. */
const kinds = { variant: 'inspect-variant', dom: 'inspect-dom', aria: 'inspect-accessibility', diagnostics: 'runtime-diagnostics' } as const
/** Per-method extra fields, never arbitrary browser evaluation. */
const fields = { variant: [], dom: ['selector', 'maxNodes', 'maxDepth'], aria: ['selector', 'maxCharacters'], accessibility: ['selector'], diagnostics: ['observationMs'] } as const
/** Validate before source lookup or lane acquisition, retaining caller settings by value. */
function normalize(kind: keyof HistoireProjectInspection, options: HistoireProjectInspectionOptions): HistoireIsolatedInspectionInput & HistoireProjectInspectionOptions {
  if (!options || !['dev', 'preview'].includes(options.source)) throw new HistoireSdkError('INVALID_ARGUMENT', 'Explicit inspection source required')
  const allowed: readonly string[] = ['source', 'storyId', 'variantId', 'expectedRevision', 'width', 'height', 'deviceScaleFactor', 'colorScheme', 'textDirection', 'globals', 'signal', ...fields[kind]]
  if (Object.keys(options).some(key => !allowed.includes(key))) throw new HistoireSdkError('INVALID_ARGUMENT', 'Unknown inspection argument')
  const { signal, ...optionFields } = options
  if (signal !== undefined) {
    try {
      Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!.call(signal)
    }
    catch { throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid inspection signal') }
  }
  // Optional fields explicitly set to undefined have the same meaning as omission.
  const data = Object.fromEntries(Object.entries(optionFields).filter(([, value]) => value !== undefined))
  measureWireValue(data, { maxBytes: 16 * 1024 })
  const input = { ...structuredClone(data), signal, width: options.width ?? 1280, height: options.height ?? 800 } as HistoireIsolatedInspectionInput & HistoireProjectInspectionOptions
  if (input.expectedRevision !== undefined && (typeof input.expectedRevision !== 'string' || !input.expectedRevision || input.expectedRevision.length > 2048)) throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid inspection revision')
  if (input.selector !== undefined && (typeof input.selector !== 'string' || !input.selector || input.selector.length > 512)) throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid inspection selector')
  for (const [name, minimum, maximum] of [['maxNodes', 1, 500], ['maxDepth', 0, 20], ['maxCharacters', 1, 32768], ['observationMs', 0, 2000]] as const) {
    const value = input[name]
    if (value !== undefined && (!Number.isInteger(value) || value < minimum || value > maximum)) throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid inspection bound')
  }
  return input
}
/** Execute through exact source-owned lane and recheck ownership after cleanup. */
export async function inspectProject<K extends keyof HistoireProjectInspection>(services: ProjectServices, kind: K, options: Parameters<HistoireProjectInspection[K]>[0]): Promise<Awaited<ReturnType<HistoireProjectInspection[K]>>> {
  try {
    const started = Date.now()
    const input = normalize(kind, options)
    const { session, execution, isActive, identity } = acquireCaptureSource(services, input, input.source)
    if (input.expectedRevision !== undefined && input.expectedRevision !== identity.revision) throw new HistoireSdkError('STALE_REVISION', 'Inspection source publication changed')
    if (kind === 'accessibility') {
      const task = createAccessibilityTask(input, session)
      const output = await awaitInspectionExecution(execution.enqueue({ ...task, validate() {
        if (!isActive()) throw new HistoireSdkError('RUNTIME_CHANGED', 'Inspection source changed')
      } }), isActive, input.signal)
      const observedAt = new Date().toISOString()
      const durationMs = Date.now() - started
      const result = validateInspectionResult({ ...output.projection, mode: 'isolated', inspection: 'accessibility', owner: { ...identity, runtimeId: output.documentId, target: { storyId: input.storyId, variantId: input.variantId } }, observedAt, durationMs })
      if (result.inspection !== 'accessibility') throw new HistoireSdkError('INTERNAL_ERROR', 'Invalid accessibility audit result')
      const { owner: _owner, ...projection } = result
      const isolated = { ...projection, mode: 'isolated', source: identity, storyId: input.storyId, variantId: input.variantId, viewport: { width: input.width, height: input.height } }
      measureWireValue(isolated, { maxBytes: 60 * 1024, maxDepth: 32 })
      return isolated as Awaited<ReturnType<HistoireProjectInspection[K]>>
    }
    const task = createInspectionTask(kinds[kind as keyof typeof kinds], input, session)
    const output = await awaitInspectionExecution(execution.enqueue({ ...task, validate() {
      if (!isActive()) throw new HistoireSdkError('RUNTIME_CHANGED', 'Inspection source changed')
    } }), isActive, input.signal)
    const result = createProjectInspectionResult(output.result, identity, Date.now() - started)
    return result as Awaited<ReturnType<HistoireProjectInspection[K]>>
  }
  catch (error) { throw toSdkExecutionError(error) }
}
