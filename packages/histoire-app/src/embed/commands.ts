import type { HistoireBridgeRequest, HistoireSourceDescriptor } from '@histoire/protocol'
import type { HistoireRequestCapture } from '@histoire/sdk/internal'
import type { EmbedSurfaceInstance } from './surfaces.js'
import type { EmbedSourceConnection } from './types.js'
import { HISTOIRE_INSPECTION_OPERATION_CAPABILITIES, HistoireSdkError } from '@histoire/protocol'

/** Unique cleanup correlation within this embedded document. */
let diagnosticCleanupId = 0
/** Policy projection applies to every revision, including later HMR publications. */
export function projectEmbedDescriptor(value: HistoireSourceDescriptor, parentOrigin: string, bookOrigin: string, allowedOrigins = value.embed?.allowedOrigins ?? []): HistoireSourceDescriptor {
  const descriptor = structuredClone(value)
  if (descriptor.inspection && !allowsInspection(descriptor, parentOrigin, bookOrigin, allowedOrigins)) {
    for (const name of Object.keys(descriptor.inspection) as (keyof typeof descriptor.inspection)[]) descriptor.inspection[name] = { available: false, reason: 'CAPABILITY_UNAVAILABLE' }
  }
  if (parentOrigin !== bookOrigin) {
    if (!descriptor.embed?.allowOpenInEditor) {
      descriptor.capabilities.openInEditor = { available: false, reason: 'CAPABILITY_UNAVAILABLE' }
    }
    if (!descriptor.embed?.allowServerTests) {
      descriptor.capabilities.serverTests = { available: false, reason: 'CAPABILITY_UNAVAILABLE' }
    }
  }
  return descriptor
}
/** Inspection has a separate origin restriction intersected with current embed policy. */
function allowsInspection(descriptor: HistoireSourceDescriptor, parentOrigin: string, bookOrigin: string, allowedOrigins: readonly string[]): boolean {
  return parentOrigin === bookOrigin || Boolean(allowedOrigins.includes(parentOrigin) && descriptor.inspectionPolicy?.allowedOrigins.includes(parentOrigin))
}
/** Cross-origin policy is enforced at execution as well as capability projection. */
export function assertEmbedCommandPolicy(source: EmbedSourceConnection, parentOrigin: string, bookOrigin: string, command: string, payload: unknown, observedOrigins?: readonly string[]): void {
  if (command.startsWith('inspection.') && command !== 'inspection.cancel') {
    const capability = HISTOIRE_INSPECTION_OPERATION_CAPABILITIES[command.slice('inspection.'.length) as keyof typeof HISTOIRE_INSPECTION_OPERATION_CAPABILITIES]
    const componentHighlight = (command === 'inspection.highlight' || command === 'inspection.highlightLease') && !!payload && typeof payload === 'object' && Object.hasOwn(payload, 'componentId')
    if (!allowsInspection(source.descriptor, parentOrigin, bookOrigin, source.allowedOrigins) || (parentOrigin !== bookOrigin && observedOrigins && !observedOrigins.includes(parentOrigin)) || !source.descriptor.inspection?.[capability]?.available || (componentHighlight && (!source.descriptor.inspection?.highlight?.available || !source.descriptor.inspection?.componentHighlight?.available))) throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Inspection unavailable')
  }
  if (parentOrigin === bookOrigin) {
    return
  }
  if (command === 'openInEditor' && !source.descriptor.embed?.allowOpenInEditor) {
    throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Cross-origin editor access disabled')
  }
  if (command === 'tests.run' && (payload as {
    mode?: string
  }).mode === 'server' && !source.descriptor.embed?.allowServerTests) {
    throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Cross-origin server tests disabled')
  }
}
/** Dispatch finite data/runtime methods using local source lifetime, never remote capture IDs. */
export async function dispatchEmbedCommand(source: EmbedSourceConnection, parentOrigin: string, bookOrigin: string, request: HistoireBridgeRequest, signal: AbortSignal, surface?: EmbedSurfaceInstance): Promise<unknown> {
  try {
    return await executeEmbedCommand(source, parentOrigin, bookOrigin, request, signal, surface)
  }
  catch (error) {
    if (['inspection.highlight', 'inspection.highlightLease'].includes(request.command)) surface?.cancelInspection?.({ ...request, signal })
    // A denied or cancelled response may follow successful runtime registration.
    // Revoke only this exact peer's observation, without publishing its result.
    const input = request.payload as { action?: string, observationId?: string }
    if (request.command === 'inspection.debug' && input && surface?.request) {
      const cleanup = { ...input, action: 'stop' }
      await Promise.resolve().then(() => surface.request!('inspection.debug', cleanup, { ...request, requestId: `diagnostic-cleanup:${++diagnosticCleanupId}`, signal: AbortSignal.timeout(3000) })).catch(() => {})
    }
    throw error
  }
}
/** Execute authorized finite commands and recheck permission after async work. */
async function executeEmbedCommand(source: EmbedSourceConnection, parentOrigin: string, bookOrigin: string, request: HistoireBridgeRequest, signal: AbortSignal, surface?: EmbedSurfaceInstance): Promise<unknown> {
  const inspection = request.command.startsWith('inspection.') && request.command !== 'inspection.cancel'
  const admissionOrigins = inspection && parentOrigin !== bookOrigin ? await source.refreshAllowedOrigins?.(signal) : undefined
  assertEmbedCommandPolicy(source, parentOrigin, bookOrigin, request.command, request.payload, admissionOrigins)
  const descriptor = source.descriptor
  const publication = { sourceId: descriptor.sourceId, epoch: descriptor.epoch, revision: descriptor.revision }
  if (['sourceId', 'epoch', 'revision'].some(key => request[key as 'sourceId'] !== descriptor[key as 'sourceId'])) {
    throw new HistoireSdkError('STALE_REVISION', 'Source publication changed')
  }
  const input = request.payload as any
  if (request.command === 'catalog.list') {
    return descriptor.catalog.stories
  }
  if (request.command === 'catalog.getStory') {
    const matches = descriptor.catalog.stories.filter(story => story.id === input.storyId)
    if (matches.length !== 1) {
      throw new HistoireSdkError(matches.length ? 'STORY_AMBIGUOUS' : 'STORY_NOT_FOUND', 'Story lookup failed')
    }
    return matches[0]
  }
  if (['subscriptions.add', 'subscriptions.remove'].includes(request.command)) {
    return null
  }
  if (['catalog.search', 'docs.get', 'openInEditor'].includes(request.command) || (request.command === 'source.get' && input.mode === 'raw') || (request.command === 'tests.run' && input.mode === 'server')) {
    const capture: HistoireRequestCapture = { ...request, connectionId: source.id, signal }
    return source.request(request.command as 'catalog.search' | 'docs.get' | 'source.get' | 'tests.run' | 'openInEditor', request.payload, capture)
  }
  if (surface?.request) {
    try {
      const result = await surface.request(request.command, request.payload, { ...request, signal })
      const completionOrigins = inspection && parentOrigin !== bookOrigin ? await source.refreshAllowedOrigins?.(signal) : undefined
      signal.throwIfAborted()
      assertEmbedCommandPolicy(source, parentOrigin, bookOrigin, request.command, request.payload, completionOrigins)
      if (source.descriptor.sourceId !== publication.sourceId || source.descriptor.epoch !== publication.epoch || source.descriptor.revision !== publication.revision) throw new HistoireSdkError('STALE_REVISION', 'Source publication changed')
      return result
    }
    catch (error) {
      const completionOrigins = inspection && parentOrigin !== bookOrigin ? await source.refreshAllowedOrigins?.(signal) : undefined
      signal.throwIfAborted()
      assertEmbedCommandPolicy(source, parentOrigin, bookOrigin, request.command, request.payload, completionOrigins)
      if (source.descriptor.sourceId !== publication.sourceId || source.descriptor.epoch !== publication.epoch || source.descriptor.revision !== publication.revision) throw new HistoireSdkError('STALE_REVISION', 'Source publication changed')
      throw error
    }
  }
  throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Requested command adapter unavailable')
}
