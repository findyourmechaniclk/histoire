import type { HistoireSession } from '@histoire/sdk'
import { describe, expect, it } from 'vitest'
import { createEventReader } from '../client/events.js'

const owner = { sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'runtime', target: { storyId: 'story', variantId: 'variant' } }
const event = (sequence: number, variantId = 'variant') => ({ sequence, timestamp: sequence, runtimeId: 'runtime', target: { storyId: 'story', variantId }, payload: { value: sequence } })

describe('live component event history', () => {
  it('keeps an event that fits an empty page for the next page', () => {
    const large = (sequence: number) => ({ ...event(sequence), payload: { text: 'x'.repeat(35_000) } })
    const snapshot = { events: { items: [large(1), large(2)], droppedCount: 0 } }
    const session = { getSnapshot: () => snapshot, subscribe: () => () => {} } as unknown as Pick<HistoireSession, 'getSnapshot' | 'subscribe'>
    const reader = createEventReader(session, owner)
    try {
      const first = reader.read({ target: owner.target, expectedOwner: owner })
      expect(first.items.map(item => item.sequence)).toEqual([1])
      expect(first.truncated).toBe(true)
      expect(first.omittedCount).toBe(0)
      expect(first.nextSequence).toBe(1)
      const second = reader.read({ target: owner.target, expectedOwner: owner, eventLifetime: first.eventLifetime, afterSequence: first.nextSequence })
      expect(second.items.map(item => item.sequence)).toEqual([2])
    }
    finally { reader.dispose() }
  })

  it('paginates attributed events and rejects a cursor after clear', () => {
    let snapshot = { events: { items: [event(3), event(4, 'other'), event(5)], droppedCount: 2 } }
    let notify: (value: typeof snapshot) => void = () => {}
    const session = { getSnapshot: () => snapshot, subscribe: (listener: (value: typeof snapshot) => void) => {
      notify = listener
      return () => {}
    } } as unknown as Pick<HistoireSession, 'getSnapshot' | 'subscribe'>
    const reader = createEventReader(session, owner)
    try {
      const first = reader.read({ target: owner.target, expectedOwner: owner, limit: 1 })
      expect(first.items.map(item => item.sequence)).toEqual([3])
      expect(first.droppedCount).toBe(2)
      expect(first.gap).toBe(true)
      const second = reader.read({ target: owner.target, expectedOwner: owner, eventLifetime: first.eventLifetime, afterSequence: first.nextSequence, limit: 5 })
      expect(second.items.map(item => item.sequence)).toEqual([5])
      expect(second.owner).toEqual(owner)
      snapshot = { events: { items: [], droppedCount: 0 } }
      notify(snapshot)
      expect(() => reader.read({ target: owner.target, expectedOwner: owner, eventLifetime: first.eventLifetime, afterSequence: first.nextSequence })).toThrow('Event lifetime unavailable')
      expect(reader.read({ target: owner.target, expectedOwner: owner }).eventLifetime).not.toBe(first.eventLifetime)
    }
    finally { reader.dispose() }
  })
})
