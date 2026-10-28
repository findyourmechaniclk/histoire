import { inspectDomDocument } from '@histoire/shared/inspection'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

describe('scoped DOM inspection', () => {
  it('keeps the selected element and excludes content outside its subtree', () => {
    const dom = new JSDOM('<main><section id="selected"><p>Inside</p></section><p>Outside</p></main>')
    try {
      const root = dom.window.document.querySelector('#selected')!
      const result = inspectDomDocument({ selector: ':scope', maxNodes: 20, maxDepth: 5 }, root)
      expect(result.matched).toBe(true)
      expect(result.nodes.map(node => [node.tag, node.text])).toEqual([['section', ''], ['p', 'Inside']])
      expect(JSON.stringify(result)).not.toContain('Outside')
    }
    finally { dom.window.close() }
  })
})
