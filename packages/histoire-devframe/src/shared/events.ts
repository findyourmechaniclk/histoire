import type { HistoireEvent, HistoireInspectionOwner } from '@histoire/protocol'
import { assertInspectionJson, measureWireValue, sameInspectionOwner, validateInspectionOwner, validateInspectionTarget } from '@histoire/protocol'

/** Finite component event pagination request. */
export interface EventRequest {
  target: HistoireInspectionOwner['target']
  expectedOwner: HistoireInspectionOwner
  afterSequence?: number
  limit?: number
  eventLifetime?: string
}

/** Bounded page of current SDK event history; loss counters are session-wide. */
export interface EventPage {
  mode: 'live'
  owner: HistoireInspectionOwner
  eventLifetime: string
  items: HistoireEvent[]
  nextSequence: number
  oldestSequence: number | null
  droppedCount: number
  gap: boolean
  truncated: boolean
  omittedCount: number
}

/** Reject extra fields, malformed cursors and unbound target identities. */
export function parseEventRequest(value: unknown): EventRequest {
  measureWireValue(value, { maxBytes: 16 * 1024, maxDepth: 32 })
  assertInspectionJson(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid event request')
  const input = value as Record<string, unknown>
  if (Object.keys(input).some(key => !['target', 'expectedOwner', 'afterSequence', 'limit', 'eventLifetime'].includes(key))) throw new Error('Invalid event request')
  const owner = validateInspectionOwner(input.expectedOwner)
  const target = validateInspectionTarget(input.target)
  if (target.storyId !== owner.target.storyId || target.variantId !== owner.target.variantId) throw new Error('Invalid event request')
  if (input.afterSequence !== undefined && (!Number.isSafeInteger(input.afterSequence) || (input.afterSequence as number) < 0)) throw new Error('Invalid event cursor')
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || (input.limit as number) < 1 || (input.limit as number) > 100)) throw new Error('Invalid event limit')
  if (input.eventLifetime !== undefined && (typeof input.eventLifetime !== 'string' || !/^[a-f0-9-]{36}$/.test(input.eventLifetime))) throw new Error('Invalid event cursor')
  if ((input.afterSequence as number | undefined ?? 0) > 0 && input.eventLifetime === undefined) throw new Error('Event lifetime unavailable')
  return input as unknown as EventRequest
}

/** Validate peer output before it leaves the broker boundary. */
export function validateEventPage(value: unknown, owner: HistoireInspectionOwner, request?: EventRequest): EventPage {
  measureWireValue(value, { maxBytes: 60 * 1024, maxDepth: 32 })
  assertInspectionJson(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid event page')
  const page = value as EventPage
  if (Object.keys(page).some(key => !['mode', 'owner', 'eventLifetime', 'items', 'nextSequence', 'oldestSequence', 'droppedCount', 'gap', 'truncated', 'omittedCount'].includes(key))) throw new Error('Invalid event page')
  if (page.mode !== 'live' || !sameInspectionOwner(validateInspectionOwner(page.owner), owner) || typeof page.eventLifetime !== 'string' || !/^[a-f0-9-]{36}$/.test(page.eventLifetime) || !Array.isArray(page.items) || page.items.length > 100) throw new Error('Invalid event page')
  if (!Number.isSafeInteger(page.nextSequence) || page.nextSequence < 0 || (page.oldestSequence !== null && (!Number.isSafeInteger(page.oldestSequence) || page.oldestSequence < 1)) || !Number.isSafeInteger(page.droppedCount) || page.droppedCount < 0 || !Number.isSafeInteger(page.omittedCount) || page.omittedCount < 0 || typeof page.gap !== 'boolean' || typeof page.truncated !== 'boolean') throw new Error('Invalid event page')
  const after = request?.afterSequence ?? 0
  if (page.nextSequence < after || (request?.eventLifetime !== undefined && page.eventLifetime !== request.eventLifetime) || (page.omittedCount > 0 && !page.truncated)) throw new Error('Invalid event page')
  let previous = after
  for (const event of page.items) {
    if (!event || typeof event !== 'object' || !Object.hasOwn(event, 'payload') || Object.keys(event).some(key => !['sequence', 'timestamp', 'runtimeId', 'target', 'payload'].includes(key)) || !Number.isSafeInteger(event.sequence) || event.sequence <= previous || event.sequence > page.nextSequence || !Number.isFinite(event.timestamp) || event.runtimeId !== owner.runtimeId || event.target?.storyId !== owner.target.storyId || event.target?.variantId !== owner.target.variantId) throw new Error('Invalid event page')
    validateInspectionTarget(event.target)
    previous = event.sequence
  }
  return page
}
