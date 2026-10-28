import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { inspectDomDocument } from '../../../../../histoire-shared/src/inspection/dom.js'

describe('bounded DOM inspection work', () => {
  it('stops visiting excluded siblings and reports omitted work', () => {
    const dom = new JSDOM(`<section id="root">${'<script></script>'.repeat(6000)}<p>unvisited</p></section>`)
    try {
      // Instrument the real DOM boundary so scanning everything cannot pass by reporting truncation afterward.
      const last = dom.window.document.querySelectorAll('script').item(5999)
      Object.defineProperty(last, 'localName', { get() {
        throw new Error('Visited beyond work budget')
      } })
      const result = inspectDomDocument({ selector: '#root', maxNodes: 500, maxDepth: 5 }, dom.window.document)
      expect(result).toMatchObject({ matched: true, truncated: true, nodes: [{ tag: 'section' }] })
    }
    finally { dom.window.close() }
  })

  it('bounds text scanning even when long whitespace normalizes away', () => {
    const dom = new JSDOM('<section id="root"></section>')
    try {
      const text = dom.window.document.createTextNode(`${' '.repeat(20_000)}unvisited`)
      // Detect full-string access while keeping native bounded substringData real.
      Object.defineProperty(text, 'nodeValue', { get() {
        throw new Error('Full text read')
      } })
      Object.defineProperty(text, 'textContent', { get() {
        throw new Error('Full text read')
      } })
      dom.window.document.querySelector('#root')!.append(text)
      const result = inspectDomDocument({ selector: '#root', maxNodes: 5, maxDepth: 2 }, dom.window.document)
      expect(result).toMatchObject({ truncated: true, nodes: [{ text: '' }] })
    }
    finally { dom.window.close() }
  })

  it('bounds attribute scanning even when earlier attributes are excluded', () => {
    const dom = new JSDOM('<section id="root"></section>')
    try {
      const root = dom.window.document.querySelector('#root')!
      for (let index = 0; index < 300; index++) root.setAttribute(`data-extra-${index}`, 'unused')
      root.setAttribute('aria-label', 'unvisited')
      // Retain native attribute lookup while detecting visits beyond the bound.
      const attributes = root.attributes
      const item = attributes.item.bind(attributes)
      Object.defineProperty(attributes, 'item', { value(index: number) {
        if (index >= 128) throw new Error('Visited beyond attribute budget')
        return item(index)
      } })
      const result = inspectDomDocument({ selector: '#root', maxNodes: 5, maxDepth: 2 }, dom.window.document)
      expect(result.truncated).toBe(true)
      expect(result.nodes[0].attributes).toEqual({ id: 'root' })
    }
    finally { dom.window.close() }
  })

  it('retains normal direct-text ordering and whitespace normalization', () => {
    const dom = new JSDOM('<section id="root">  Alpha\n<!-- split --> beta <span>child</span>  gamma  </section>')
    try {
      const result = inspectDomDocument({ selector: '#root', maxNodes: 5, maxDepth: 2 }, dom.window.document)
      expect(result).toMatchObject({ truncated: false, nodes: [{ tag: 'section', text: 'Alpha beta gamma' }, { tag: 'span', text: 'child' }] })
    }
    finally { dom.window.close() }
  })
})
