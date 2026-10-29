import type { AxeResults } from 'axe-core'
import { describe, expect, it } from 'vitest'
import { evaluateResults } from '../scanner/policy.js'

/** Complete engine data, independent of bounded UI projection. */
function results(impacts: (string | null)[]): AxeResults {
  return { violations: impacts.map((impact, index) => ({ id: `rule-${index}`, impact, help: 'Fix control', helpUrl: 'https://example.com/rule', nodes: [{ target: ['#control'], failureSummary: 'Missing name' }] })), incomplete: [{ id: 'review', nodes: [] }] } as unknown as AxeResults
}

describe('accessibility test failure policy', () => {
  it('fails all violations by default with actionable details', () => {
    const evaluated = evaluateResults(results(['minor', 'critical', null]))
    expect(evaluated.failed).toBe(3)
    for (const text of ['rule-0 [minor]', '#control', 'Missing name', 'https://example.com/rule']) expect(evaluated.message).toContain(text)
    expect(evaluated.review).toBe(1)
  })

  it('keeps unknown impact failing without failing needs-review results', () => {
    expect(evaluateResults(results(['minor', 'moderate', 'serious', 'critical', null]), 'serious')).toMatchObject({ failed: 3, belowThreshold: 2, review: 1 })
    expect(evaluateResults(results([]))).toMatchObject({ failed: 0, review: 1 })
  })

  it('evaluates all rules before bounding diagnostics', () => {
    const evaluated = evaluateResults(results([...Array.from({ length: 600 }, () => 'minor'), 'critical']), 'critical')
    expect(evaluated.failed).toBe(1)
    expect(evaluated.message).toContain('rule-600 [critical]')
    const all = evaluateResults(results(Array.from({ length: 600 }, () => 'serious')))
    expect(all.failed).toBe(600)
    expect(all.message.length).toBeLessThan(14000)
    expect(all.message).toContain('omitted')
  })
})
