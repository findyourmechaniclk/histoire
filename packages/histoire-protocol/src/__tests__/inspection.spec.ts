import { describe, expect, it } from 'vitest'
import { validateInspectionInput, validateInspectionOwner, validateInspectionResult } from '../inspection/validation.js'

const owner = { sourceId: 'book', epoch: 'e', revision: 'r', runtimeId: 'doc', target: { storyId: 'story', variantId: 'variant' } }

describe('inspection contracts', () => {
  it('rejects authority and unknown argument injection before dispatch', () => {
    expect(() => validateInspectionInput('dom', { selector: 'button', javascript: 'bad' })).toThrow()
    expect(() => validateInspectionOwner({ ...owner, principal: 'admin' })).toThrow()
    expect(() => validateInspectionInput('dom', { maxNodes: 501 })).toThrow()
    expect(validateInspectionInput('dom', { selector: 'button', maxNodes: 2 })).toEqual({ selector: 'button', maxNodes: 2 })
  })
  it('requires one highlight locator and an exact rendered target', () => {
    expect(() => validateInspectionInput('highlight', {})).toThrow()
    expect(() => validateInspectionInput('highlight', { selector: 'button', componentId: '1' })).toThrow()
    expect(() => validateInspectionOwner({ ...owner, target: { storyId: 'story', variantId: null } })).toThrow()
  })
  it('rejects oversized or non-JSON results including identities', () => {
    const result = { mode: 'live', owner, observedAt: new Date().toISOString(), durationMs: 0, truncated: false, inspection: 'dom', matched: false, nodes: [] }
    expect(validateInspectionResult(result)).toEqual(result)
    expect(() => validateInspectionResult({ ...result, nodes: Array.from({ length: 200 }).fill({ text: 'x'.repeat(4096) }) })).toThrow()
    expect(() => validateInspectionResult({ ...result, hidden: () => 1 })).toThrow()
  })
  it('rejects malformed rows instead of trusting arrays from a runtime', () => {
    const result = { mode: 'live', owner, observedAt: new Date().toISOString(), durationMs: 0, truncated: false, inspection: 'dom', matched: true }
    expect(() => validateInspectionResult({ ...result, nodes: [{ tag: 'button' }] })).toThrow()
    const node = { index: 0, parentIndex: null, tag: 'button', attributes: {}, text: 'Save', rect: { x: 0, y: 0, width: 10, height: 20 }, styles: {} }
    expect(() => validateInspectionResult({ ...result, nodes: [node] })).not.toThrow()
    expect(() => validateInspectionResult({ ...result, nodes: [{ ...node, parentIndex: 1 }] })).toThrow()
    expect(() => validateInspectionResult({ ...result, nodes: [{ ...node, rect: { ...node.rect, width: -1 } }] })).toThrow()
    const variant = { ...result, inspection: 'variant', state: {}, components: [{ name: 'Button', index: 0, props: [{ name: 'label', required: 'yes' }] }], propsAvailable: true, omittedValues: 0 }
    delete (variant as any).matched
    expect(() => validateInspectionResult(variant)).toThrow()
  })
})

it('rejects accessors without running user code, including before locator access', () => {
  let reads = 0
  const hostile = Object.defineProperty({}, 'selector', { enumerable: true, get() {
    reads++
    return 'button'
  } })
  expect(() => validateInspectionInput('dom', hostile)).toThrow()
  expect(reads).toBe(0)
  const deep: Record<string, unknown> = {}
  let tail = deep
  for (let index = 0; index < 40; index++) {
    const next = {}
    tail.child = next
    tail = next
  }
  expect(() => validateInspectionInput('variant', deep)).toThrow()
  for (const value of [JSON.parse('{"__proto__":{}}'), { selector: Symbol('bad') }, { selector: () => 'button' }]) expect(() => validateInspectionInput('dom', value)).toThrow()
})

it('distinguishes unmatched elements from unavailable component ownership', () => {
  const common = { mode: 'live', owner, observedAt: '2026-01-01T00:00:00Z', durationMs: 0, truncated: false, inspection: 'componentForElement', coverage: 'partial', limitations: ['teleport'] }
  expect(validateInspectionResult({ ...common, matched: false, node: null })).toBeDefined()
  expect(validateInspectionResult({ ...common, matched: true, node: null, unavailableReason: 'outside-owned-root' })).toBeDefined()
  expect(() => validateInspectionResult({ ...common, matched: true, node: null })).toThrow()
  expect(() => validateInspectionResult({ ...common, matched: false, node: null, unavailableReason: 'owner-unavailable' })).toThrow()
  expect(() => validateInspectionResult({ ...common, coverage: 'complete', matched: false, node: null })).toThrow()
  expect(() => validateInspectionInput('componentForElement', {})).toThrow()
  expect(validateInspectionInput('componentForElement', { selector: '[data-test]' })).toEqual({ selector: '[data-test]' })
})
