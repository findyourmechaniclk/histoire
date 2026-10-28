import type { HistoireInspectionOwner } from '@histoire/protocol'
import type { HistoireSession } from '@histoire/sdk'
import type { EventPage } from '../shared/events.js'
import { measureWireValue, sameInspectionOwner } from '@histoire/protocol'
import { parseEventRequest, validateEventPage } from '../shared/events.js'

/** Project SDK-owned event history without starting diagnostics instrumentation. */
export function createEventReader(session: Pick<HistoireSession, 'getSnapshot' | 'subscribe'>, owner: HistoireInspectionOwner) {
  let eventLifetime = crypto.randomUUID()
  let previous = session.getSnapshot().events
  /** Clearing history or resetting loss accounting invalidates previous cursors. */
  const unsubscribe = session.subscribe((snapshot) => {
    const next = snapshot.events
    if ((previous.items.length > 0 && next.items.length === 0) || next.droppedCount < previous.droppedCount) eventLifetime = crypto.randomUUID()
    previous = next
  })
  return {
    /** Paginate only events attributed to the captured runtime and exact target. */
    read(input: unknown): EventPage {
      const request = parseEventRequest(input)
      if (!sameInspectionOwner(request.expectedOwner, owner)) throw new Error('Event lifetime unavailable')
      if (request.eventLifetime !== undefined && request.eventLifetime !== eventLifetime) throw new Error('Event lifetime unavailable')
      const snapshot = session.getSnapshot()
      const after = request.afterSequence ?? 0
      const oldest = snapshot.events.items[0]?.sequence ?? null
      const matching = snapshot.events.items.filter(item => item.sequence > after && item.runtimeId === owner.runtimeId && item.target.storyId === owner.target.storyId && item.target.variantId === owner.target.variantId)
      const page: EventPage = { mode: 'live', owner: structuredClone(owner), eventLifetime, items: [], nextSequence: after, oldestSequence: oldest, droppedCount: snapshot.events.droppedCount, gap: snapshot.events.droppedCount > 0 && (after === 0 || (oldest !== null && after < oldest - 1)), truncated: false, omittedCount: 0 }
      for (const item of matching) {
        if (page.items.length >= (request.limit ?? 50)) {
          page.truncated = true
          break
        }
        const candidate = structuredClone(item)
        try {
          measureWireValue({ ...page, items: [...page.items, candidate], nextSequence: candidate.sequence }, { maxBytes: 60 * 1024, maxDepth: 32 })
        }
        catch {
          page.truncated = true
          if (page.items.length) break
          page.omittedCount++
          page.nextSequence = candidate.sequence
          continue
        }
        page.items.push(candidate)
        page.nextSequence = candidate.sequence
      }
      return validateEventPage(page, owner, request)
    },
    /** Stop only this reader's snapshot listener. */
    dispose() { unsubscribe() },
  }
}
