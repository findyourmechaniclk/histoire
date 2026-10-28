import type { HistoireInspectionResult, HistoireJsonValue } from '@histoire/protocol'
import { assertInspectionJson, measureWireValue } from '@histoire/protocol'

/** Caller explicitly selects fields and supplies all sanitization; it owns sensitivity decisions. */
export interface InspectionContentOptions {
  /** Fields and nodes selected per result; unselected data is never copied. */
  selections: readonly ({ index: number, stateKeys: readonly string[] } | { index: number, nodeIndexes: readonly number[] })[]
  /** Sanitize a detached selected value before export. Must return bounded JSON. */
  sanitize: (value: HistoireJsonValue, context: { resultIndex: number, kind: 'state' | 'dom', key: string | number }) => HistoireJsonValue
}

/** Explicit selected content with no attributes, selectors, URLs or raw runtime handles. */
export interface InspectionReportContent {
  /** Selected caller-sanitized state fields. */
  state?: Record<string, HistoireJsonValue>
  /** Selected caller-sanitized node text and bounded structural identity. */
  dom?: { index: number, parentIndex: number | null, tag: string, text: string }[]
}

const TAGS = new Set(['a', 'article', 'aside', 'button', 'div', 'footer', 'form', 'h1', 'h2', 'h3', 'header', 'input', 'label', 'li', 'main', 'nav', 'ol', 'option', 'p', 'section', 'select', 'span', 'strong', 'table', 'tbody', 'td', 'textarea', 'th', 'thead', 'tr', 'ul'])

/** Clone JSON after validation; neither source nor caller-owned sanitizer result is retained. */
function detached(value: unknown): HistoireJsonValue {
  assertInspectionJson(value)
  measureWireValue(value, { maxBytes: 16 * 1024, maxDepth: 16 })
  return JSON.parse(JSON.stringify(value)) as HistoireJsonValue
}

/** Validate and apply explicit selections to already validated results. */
export function selectReportContent(options: InspectionContentOptions, results: readonly HistoireInspectionResult[]): Map<number, InspectionReportContent> {
  const fields = options && Object.getOwnPropertyDescriptors(options)
  const selections = fields?.selections && 'value' in fields.selections ? fields.selections.value : undefined
  const sanitize = fields?.sanitize && 'value' in fields.sanitize ? fields.sanitize.value : undefined
  if (!fields || Object.keys(fields).some(key => !['selections', 'sanitize'].includes(key)) || !Array.isArray(selections) || selections.length > 32 || typeof sanitize !== 'function') throw new Error('Selected report content requires explicit selections and sanitizer')
  assertInspectionJson(selections)
  const output = new Map<number, InspectionReportContent>()
  let contentBytes = 0
  /** Stop while constructing content, before aggregate data can grow beyond the report budget. */
  function retain(value: unknown, key: string): HistoireJsonValue {
    const copy = detached(value)
    contentBytes += measureWireValue(copy, { maxBytes: 16 * 1024, maxDepth: 16 }) + new TextEncoder().encode(key).length
    if (contentBytes > 48 * 1024) throw new Error('Selected report content exceeds size limit')
    return copy
  }
  for (const selection of selections) {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection) || Object.keys(selection).some(key => !['index', 'stateKeys', 'nodeIndexes'].includes(key))) throw new Error('Invalid report selection')
    const { index, stateKeys, nodeIndexes } = selection
    if (!Number.isSafeInteger(index) || index < 0 || index >= results.length || output.has(index)) throw new Error('Invalid report result index')
    const result = results[index]
    if (result.inspection === 'variant' && Array.isArray(stateKeys) && nodeIndexes === undefined && stateKeys.length <= 100) {
      const fields: Record<string, HistoireJsonValue> = Object.create(null)
      for (const key of stateKeys) {
        if (typeof key !== 'string' || key.length > 256 || !Object.hasOwn(result.state, key) || Object.hasOwn(fields, key) || ['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid report state field')
        fields[key] = retain(sanitize(detached(result.state[key]), { resultIndex: index, kind: 'state', key }), key)
      }
      output.set(index, { state: fields })
    }
    else if (result.inspection === 'dom' && Array.isArray(nodeIndexes) && stateKeys === undefined && nodeIndexes.length <= 100) {
      const seen = new Set<number>()
      const nodes = nodeIndexes.map((nodeIndex: unknown) => {
        if (!Number.isSafeInteger(nodeIndex) || seen.has(nodeIndex as number)) throw new Error('Invalid report DOM node')
        const node = result.nodes.find(item => item.index === nodeIndex)
        if (!node) throw new Error('Invalid report DOM node')
        seen.add(nodeIndex as number)
        const text = retain(sanitize(node.text, { resultIndex: index, kind: 'dom', key: node.index }), node.tag)
        if (typeof text !== 'string') throw new Error('DOM sanitizer must return text')
        return { index: node.index, parentIndex: node.parentIndex, tag: TAGS.has(node.tag) ? node.tag : 'other', text }
      })
      output.set(index, { dom: nodes })
    }
    else {
      throw new Error('Selection does not match inspection result')
    }
  }
  return output
}
