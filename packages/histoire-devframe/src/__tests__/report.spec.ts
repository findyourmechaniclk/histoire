import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createInspectionReport } from '../report/index.js'
import { reportDom, reportMetadata, reportOwner, reportSecret, reportVariant } from './fixtures/report.js'

/** Independent fingerprint oracle; report never writes raw identity or data. */
function fingerprint(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

describe('detached inspection report', () => {
  it('retains bounded historical ownership and summary, without payloads, credentials or executable HTML', () => {
    const report = createInspectionReport({ results: [reportVariant, reportDom] })
    expect(report.data.entries).toEqual([
      { mode: 'live', inspection: 'variant', observedAt: reportMetadata.observedAt, source: fingerprint(reportOwner.sourceId), epoch: fingerprint(reportOwner.epoch), revision: fingerprint(reportOwner.revision), runtime: fingerprint(reportOwner.runtimeId), story: fingerprint(reportOwner.target.storyId), variant: fingerprint(reportOwner.target.variantId), truncated: false, stateFields: 2, components: 0, omittedValues: 0 },
      { mode: 'live', inspection: 'dom', observedAt: reportMetadata.observedAt, source: fingerprint(reportOwner.sourceId), epoch: fingerprint(reportOwner.epoch), revision: fingerprint(reportOwner.revision), runtime: fingerprint(reportOwner.runtimeId), story: fingerprint(reportOwner.target.storyId), variant: fingerprint(reportOwner.target.variantId), truncated: false, matched: true, elements: 1 },
    ])
    for (const output of [JSON.stringify(report.data), report.html]) {
      expect(output).not.toContain(reportSecret)
      expect(output).not.toContain('<script>')
      expect(output).not.toContain('<img')
      expect(output).not.toContain('onerror')
    }
    expect(report.html).toContain('Historical inspection')
    expect(report.html).toContain('Content-Security-Policy')
    expect(report.html).not.toMatch(/<(script|button|form|a)\b/i)
  })

  it('exports only explicitly selected content after caller sanitization and escapes markup', () => {
    const result = createInspectionReport({
      results: [reportVariant, reportDom],
      content: {
        selections: [{ index: 0, stateKeys: ['markup'] }, { index: 1, nodeIndexes: [0] }],
        sanitize: value => typeof value === 'string' ? value.replaceAll(reportSecret, '[redacted]') : value,
      },
    })
    expect(result.data.entries[0].content).toEqual({ state: { markup: '<script>alert(1)</script>' } })
    expect(result.data.entries[1].content).toEqual({ dom: [{ index: 0, parentIndex: null, tag: 'button', text: '<img src=x onerror=alert(1)>[redacted]' }] })
    expect(result.html).toContain('&lt;script&gt;')
    expect(result.html).toContain('&lt;img')
    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('<img')
    expect(JSON.stringify(result.data)).not.toContain(reportSecret)
    expect(result.html).not.toContain(reportSecret)
    expect(JSON.stringify(result.data)).not.toContain('"token"')
  })

  it('rejects selected content without a sanitizer, unknown fields, and unsupported indexes', () => {
    expect(() => createInspectionReport({ results: [reportVariant], content: { selections: [{ index: 0, stateKeys: ['token'] }] } } as any)).toThrow()
    expect(() => createInspectionReport({ results: [reportVariant], content: { selections: [{ index: 0, stateKeys: ['unknown'] }], sanitize: value => value } })).toThrow()
    expect(() => createInspectionReport({ results: [reportDom], content: { selections: [{ index: 0, nodeIndexes: [9] }], sanitize: value => value } })).toThrow()
    const large = { ...reportVariant, state: { a: 1, b: 2, c: 3, d: 4 } }
    expect(() => createInspectionReport({ results: [large], content: { selections: [{ index: 0, stateKeys: ['a', 'b', 'c', 'd'] }], sanitize: () => 'x'.repeat(15_000) } })).toThrow()
  })

  it('detaches selected nested data and rejects unsafe sanitizer output', () => {
    const input = { ...reportVariant, state: { settings: { label: 'original', token: reportSecret } } }
    const sanitized = { label: 'safe' }
    const result = createInspectionReport({
      results: [input],
      content: { selections: [{ index: 0, stateKeys: ['settings'] }], sanitize: (value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) value.label = 'changed copy'
        return sanitized
      } },
    })
    sanitized.label = 'changed after export'
    expect(input.state.settings.label).toBe('original')
    expect(result.data.entries[0].content).toEqual({ state: { settings: { label: 'safe' } } })
    let invoked = false
    const unsafe = Object.defineProperty({}, 'secret', { enumerable: true, get() {
      invoked = true
      return reportSecret
    } })
    expect(() => createInspectionReport({ results: [input], content: { selections: [{ index: 0, stateKeys: ['settings'] }], sanitize: () => unsafe } })).toThrow()
    expect(invoked).toBe(false)
  })

  it('rejects over-limit, malformed and accessor-bearing data without invoking getters', () => {
    const variant = { ...reportMetadata, inspection: 'variant', state: {}, components: [], propsAvailable: false, omittedValues: 0 }
    expect(() => createInspectionReport({ results: Array.from({ length: 33 }).fill(variant) })).toThrow()
    let invoked = false
    const hostile = { ...variant, state: Object.defineProperty({}, 'token', { enumerable: true, get() {
      invoked = true
      return reportSecret
    } }) }
    expect(() => createInspectionReport({ results: [hostile] })).toThrow()
    expect(invoked).toBe(false)
    const list = Object.defineProperty([variant], '0', { get() {
      invoked = true
      return variant
    } })
    expect(() => createInspectionReport({ results: list })).toThrow()
    const options = Object.defineProperty({}, 'results', { get() {
      invoked = true
      return [variant]
    } })
    expect(() => createInspectionReport(options as { results: unknown[] })).toThrow()
    expect(invoked).toBe(false)
    expect(() => createInspectionReport({ results: [{ ...variant, owner: { ...reportOwner, token: reportSecret } }] })).toThrow()
  })
})
