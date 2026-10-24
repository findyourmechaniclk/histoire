// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { auditElement } from '../domain/audit.js'

/**
 * Builds a rendered variant root.
 * @param html Inner markup.
 */
function root(html: string): HTMLElement {
  const element = document.createElement('div')
  element.innerHTML = html
  document.body.append(element)
  return element
}

/**
 * Gives an element a rendered box (jsdom has no layout).
 * @param element Element to size.
 * @param width Box width.
 * @param height Box height.
 */
function size(element: Element, width: number, height: number): void {
  element.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) })
}

describe('reference audit', () => {
  it('reports images without alt text and controls without an accessible name', () => {
    const element = root(`
      <img src="a.png"><img src="b.png" alt="">
      <button></button><button aria-label="Close"></button><button>Save</button>
      <a href="#"><img src="c.png"></a><span role="button" title="Menu"></span>
    `)
    const { report, elements } = auditElement(element, { minTargetSize: 0 })
    expect(report.issues.map(issue => issue.rule)).toEqual(['missing-alt', 'missing-alt', 'unnamed-control', 'unnamed-control'])
    // Issue indexes address the audited elements, so the workbench can ask for a highlight.
    expect(elements[2]).toBe(element.querySelector('button'))
    expect(report.nodes).toBe(element.querySelectorAll('*').length)
  })

  it('reports rendered targets below the configured size and ignores unrendered ones', () => {
    const element = root('<button>Small</button><button>Large</button><button hidden>Hidden</button>')
    const [small, large] = element.querySelectorAll('button')
    size(small, 30, 16)
    size(large, 48, 48)
    expect(auditElement(element, { minTargetSize: 24 }).report.issues).toEqual([
      { rule: 'small-target', element: 'button', message: '30×16 px, below 24 px' },
    ])
    expect(auditElement(element, { minTargetSize: 0 }).report.issues).toEqual([])
  })

  it('produces JSON data that survives the plugin channel', () => {
    const element = root('<img src="x.png" class="hero wide" id="cover">')
    const { report } = auditElement(element, { minTargetSize: 24 })
    expect(JSON.parse(JSON.stringify(report))).toEqual(report)
    expect(report.issues[0].element).toBe('img#cover.hero.wide')
  })
})
