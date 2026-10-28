import type { HistoireDebugEntry, HistoireDebugPage } from '../types/debug.js'

/** Bounded detached timeline; sequence numbers also account for omitted entries. */
export function createDebugBuffer(options: { maxEntries?: number, maxBytes?: number } = {}) {
  const rows: { entry: HistoireDebugEntry, bytes: number }[] = []
  const encoder = new TextEncoder()
  const maxEntries = options.maxEntries ?? 1000
  const maxBytes = options.maxBytes ?? 1024 * 1024
  let sequence = 0
  let bytes = 0
  let droppedCount = 0
  /** Measure serialized UTF-8 including escaped strings and metadata. */
  function size(value: unknown): number {
    return encoder.encode(JSON.stringify(value)).byteLength
  }
  return {
    /** Latest allocated sequence including dropped observations. */
    cursor(): number { return sequence },
    /** Add only detached complete entries within the per-entry bound. */
    add(value: Omit<HistoireDebugEntry, 'sequence'>): void {
      const entry = { ...value, sequence: ++sequence, message: value.message.slice(0, 2048) }
      while (size(entry) > 4096 && entry.message.length) entry.message = entry.message.slice(0, Math.floor(entry.message.length / 2))
      const length = size(entry)
      if (length > 4096 || length > maxBytes) {
        droppedCount++
        return
      }
      rows.push({ entry: structuredClone(entry), bytes: length })
      bytes += length
      while (rows.length > maxEntries || bytes > maxBytes) {
        bytes -= rows.shift()!.bytes
        droppedCount++
      }
    },
    /** Count observations omitted before retention and reserve their sequence numbers. */
    drop(count = 1): void {
      if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(sequence + count)) throw new Error('Invalid diagnostic loss count')
      sequence += count
      droppedCount += count
    },
    /** Return a complete bounded page with loss and continuation metadata. */
    read(input: { afterSequence?: number, limit?: number } = {}): HistoireDebugPage {
      const after = input.afterSequence ?? 0
      const limit = input.limit ?? 100
      if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid diagnostic cursor or limit')
      const oldestSequence = rows[0]?.entry.sequence ?? sequence + 1
      const items: HistoireDebugEntry[] = []
      let cursor = after
      let gap = false
      for (const row of rows) {
        if (row.entry.sequence <= after) continue
        if (items.length >= limit) break
        const candidate = [...items, row.entry]
        const candidateGap: boolean = gap || row.entry.sequence > cursor + 1
        if (size({ items: candidate, nextSequence: row.entry.sequence, oldestSequence, droppedCount, gap: candidateGap }) > 44 * 1024) break
        gap = candidateGap
        cursor = row.entry.sequence
        items.push(row.entry)
      }
      // Advancing over a loss-only tail makes the gap visible once without stalling polling.
      if (!items.length && sequence > after) {
        gap = true
        cursor = sequence
      }
      return structuredClone({ items, nextSequence: cursor, oldestSequence, droppedCount, gap })
    },
    /** Discard retained rows without recycling identities or hiding their loss. */
    clear(): void {
      droppedCount += rows.length
      rows.length = 0
      bytes = 0
    },
  }
}
