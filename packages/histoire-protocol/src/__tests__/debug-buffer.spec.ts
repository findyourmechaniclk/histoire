import { describe, expect, it } from 'vitest'
import { createDebugBuffer } from '../inspection/debug-buffer.js'

const entry = (message: string) => ({ kind: 'console' as const, message, timestamp: 1, monotonicTimeMs: 1 })

describe('diagnostic timeline', () => {
  it('paginates in sequence and reports overflow and cleared history', () => {
    const buffer = createDebugBuffer({ maxEntries: 2 })
    buffer.add(entry('first'))
    buffer.add(entry('second'))
    buffer.add(entry('third'))
    expect(buffer.read({ afterSequence: 0, limit: 1 })).toEqual({ items: [{ ...entry('second'), sequence: 2 }], nextSequence: 2, oldestSequence: 2, droppedCount: 1, gap: true })
    expect(buffer.read({ afterSequence: 2 })).toEqual({ items: [{ ...entry('third'), sequence: 3 }], nextSequence: 3, oldestSequence: 2, droppedCount: 1, gap: false })
    buffer.clear()
    buffer.add(entry('fourth'))
    expect(buffer.read({ afterSequence: 3 })).toEqual({ items: [{ ...entry('fourth'), sequence: 4 }], nextSequence: 4, oldestSequence: 4, droppedCount: 3, gap: false })
  })

  it('bounds serialized output, reports source loss and returns detached entries', () => {
    const buffer = createDebugBuffer()
    buffer.add(entry('a'.repeat(20_000)))
    buffer.drop(2)
    buffer.add(entry('last'))
    const page = buffer.read()
    expect(page.items.map(row => row.sequence)).toEqual([1, 4])
    expect(page.gap).toBe(true)
    expect(page.droppedCount).toBe(2)
    expect(new TextEncoder().encode(JSON.stringify(page)).length).toBeLessThanOrEqual(48 * 1024)
    expect(new TextEncoder().encode(JSON.stringify(page.items[0])).length).toBeLessThanOrEqual(4096)
    page.items[0].message = 'changed'
    expect(buffer.read().items[0].message).not.toBe('changed')
    expect(() => buffer.read({ limit: 0 })).toThrow()
  })
})
