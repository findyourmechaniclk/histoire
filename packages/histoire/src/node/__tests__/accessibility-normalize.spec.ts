import { describe, expect, it } from 'vitest'
import { normalizeAccessibility } from '../runtime/inspection/accessibility-normalize.js'

describe('bounded axe report projection', () => {
  it('omits unsupported targets without returning misleading partial selectors', () => {
    const result = normalizeAccessibility('4.14.0', true, {
      violations: [{
        id: 'example',
        help: 'Example',
        helpUrl: 'https://example.test/rule',
        nodes: [
          { target: ['#valid'] },
          { target: ['#frame', ['#host', '#shadow-node']] },
          { target: ['#valid', ''] },
          { target: ['#valid', '  '] },
          { target: ['#valid', 'x'.repeat(513)] },
          { target: Array.from({ length: 101 }, (_, index) => `#node-${index}`) },
          { target: [] },
          { target: '#not-an-array' },
        ],
      }],
      incomplete: [],
      passes: [],
      inapplicable: [],
    })
    expect(result.violations[0].nodes).toEqual([{ selectors: ['#valid'] }])
    expect(result.droppedCount).toBe(7)
    expect(result.truncated).toBe(true)
  })

  it('keeps safe findings within the full byte budget and reports omitted data', () => {
    const result = normalizeAccessibility('4.14.0', true, {
      violations: [
        { id: 'unsafe', impact: 'serious', help: 'Unsafe', helpUrl: 'javascript:alert(1)', nodes: [{ target: ['#unsafe'] }] },
        { id: 'image-alt', impact: 'critical', help: 'Images need names', helpUrl: 'https://example.test/rule', nodes: Array.from({ length: 600 }, (_, index) => ({ target: [`#image-${index}`], failureSummary: 'x'.repeat(4000), html: '<img private>' })) },
      ],
      incomplete: [],
      passes: [{}, {}],
      inapplicable: [{}],
    })
    expect(result.violations.map(item => item.id)).toEqual(['image-alt'])
    expect(result.violations[0].nodes[0].selectors).toEqual(['#image-0'])
    expect(result.violations[0].nodes.length).toBeLessThan(500)
    expect(result.droppedCount).toBeGreaterThan(100)
    expect(result.truncated).toBe(true)
    expect(result.passesCount).toBe(2)
    expect(result.inapplicableCount).toBe(1)
    expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThanOrEqual(40 * 1024)
    expect(JSON.stringify(result)).not.toContain('<img private>')
  })
})
