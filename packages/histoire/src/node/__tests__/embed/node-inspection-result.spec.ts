import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { createProjectInspectionResult } from '../../api/inspection-result.js'

describe('isolated inspection result adaptation', () => {
  it('adds source metadata within the byte limit without mutating retained ARIA output', () => {
    const snapshot = '\u0003'.repeat(10_200)
    const output = { inspection: 'accessibility' as const, storyId: 'story', variantId: 'variant', viewport: { width: 1280, height: 800 }, matched: true, snapshot, totalCharacters: snapshot.length, truncated: false }
    const source = { sourceId: 's'.repeat(36), epoch: 'e'.repeat(36), revision: 'r'.repeat(36) }
    expect(Buffer.byteLength(JSON.stringify(output))).toBeLessThanOrEqual(60 * 1024)
    const result = createProjectInspectionResult(output, source, 1)
    expect(result).toMatchObject({ inspection: 'accessibility', mode: 'isolated', source, truncated: true, totalCharacters: snapshot.length })
    if (result.inspection !== 'accessibility') throw new Error('Unexpected inspection kind')
    expect(result.snapshot.length).toBeLessThan(snapshot.length)
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(60 * 1024)
    expect(output.snapshot).toBe(snapshot)
    expect(output.truncated).toBe(false)
  })

  it('does not remove retained diagnostic entries while adding source metadata', () => {
    const entries = Array.from({ length: 100 }, () => ({ kind: 'console' as const, message: 'x'.repeat(570) }))
    const output = { inspection: 'diagnostics' as const, storyId: 'story', variantId: 'variant', viewport: { width: 1280, height: 800 }, previewReady: true, entries, droppedCount: 0, truncated: false }
    const remaining = 60 * 1024 - 50 - Buffer.byteLength(JSON.stringify(output))
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThan(3000)
    entries.at(-1)!.message += 'x'.repeat(remaining)
    const retained = structuredClone(output)
    const source = { sourceId: 's'.repeat(36), epoch: 'e'.repeat(36), revision: 'r'.repeat(36) }
    const result = createProjectInspectionResult(output, source, 1)
    if (result.inspection !== 'diagnostics') throw new Error('Unexpected inspection kind')
    expect(result.truncated).toBe(true)
    expect(result.entries.length).toBeLessThan(retained.entries.length)
    expect(output).toEqual(retained)
  })
})
