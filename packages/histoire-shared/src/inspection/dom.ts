/** Bounded subtree query, shared by real browser evaluation and DOM behavior tests. */
export interface DomInspectionOptions {
  /** First matching element is root; caller supplies no executable code. */
  selector: string
  /** Maximum included elements. */
  maxNodes: number
  /** Root is depth zero. */
  maxDepth: number
}

/** Self-contained browser function; no imported values survive serialization. */
export function inspectDomDocument(options: DomInspectionOptions, rootDocument: Document | Element = document) {
  const document_ = rootDocument.nodeType === 9 ? rootDocument as Document : rootDocument.ownerDocument!
  const root = options.selector === ':scope' && rootDocument.nodeType === 1 ? rootDocument as Element : rootDocument.querySelector(options.selector)
  const nodes: { index: number, parentIndex: number | null, tag: string, attributes: Record<string, string>, text: string, rect: { x: number, y: number, width: number, height: number }, styles: Record<string, string> }[] = []
  let truncated = false
  let bytes = 0
  let byteBudgetExhausted = false
  let remainingWork = 5000
  let remainingText = 64 * 1024
  /** Count inspected nodes and attributes, including ones omitted from output. */
  function consumeWork(): boolean {
    if (remainingWork > 0) {
      remainingWork--
      return true
    }
    truncated = true
    return false
  }
  /** Bound raw text before whitespace normalization or concatenation allocates. */
  function directText(element: Element): string {
    if (element.localName === 'textarea' || element.getAttribute('type') === 'password') return ''
    const pieces: string[] = []
    let remaining = Math.min(4096, remainingText)
    const children = element.childNodes
    for (let index = 0; index < children.length; index++) {
      if (!consumeWork()) break
      const child = children.item(index)
      if (child.nodeType !== 3) continue
      const value = child as Text
      const length = value.length
      const take = Math.min(length, remaining)
      pieces.push(value.substringData(0, take))
      remaining -= take
      remainingText -= take
      if (take < length || (remaining === 0 && index + 1 < children.length)) {
        truncated = true
        break
      }
    }
    const text = pieces.join(' ').replace(/\s+/g, ' ').trim()
    if (text.length > 1000) truncated = true
    return text.slice(0, 1000)
  }
  /** Append complete rows only; both traversal and serialized result stay bounded. */
  function visit(element: Element, parentIndex: number | null, depth: number): void {
    if (['script', 'style', 'noscript', 'template'].includes(element.localName)) return
    if (nodes.length >= options.maxNodes) {
      truncated = true
      return
    }
    const attributes: Record<string, string> = {}
    const elementAttributes = element.attributes
    for (let index = 0; index < elementAttributes.length; index++) {
      if (index >= 128 || !consumeWork()) {
        truncated = true
        break
      }
      const attribute = elementAttributes.item(index)!
      const name = attribute.name
      if (!['id', 'class', 'role', 'type', 'disabled', 'checked', 'data-testid', 'data-test-id', 'href', 'src'].includes(name) && !name.startsWith('aria-')) continue
      if (name.length > 256) {
        truncated = true
        continue
      }
      if (Object.keys(attributes).length >= 32) {
        truncated = true
        break
      }
      let value = attribute.value
      if (name === 'href' || name === 'src') {
        if (value.length > 2048) {
          truncated = true
          continue
        }
        try {
          const url = new URL(value, rootDocument.baseURI)
          if (!['http:', 'https:'].includes(url.protocol)) continue
          value = url.origin + url.pathname
        }
        catch { continue }
      }
      if (value.length > 512) truncated = true
      attributes[name] = value.slice(0, 512)
    }
    const style = document_.defaultView!.getComputedStyle(element)
    const styles: Record<string, string> = {}
    for (const name of ['display', 'visibility', 'position', 'color', 'backgroundColor', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'padding', 'margin', 'border', 'borderRadius', 'opacity', 'overflow', 'boxSizing']) {
      const value = String(style[name] ?? '')
      if (value.length > 512) truncated = true
      styles[name] = value.slice(0, 512)
    }
    const bounds = element.getBoundingClientRect()
    const rect = { x: 0, y: 0, width: 0, height: 0 }
    for (const name of ['x', 'y', 'width', 'height'] as const) rect[name] = Number.isFinite(bounds[name]) ? bounds[name] : 0
    // Direct text avoids duplicated subtree text and executable script contents.
    const text = directText(element)
    const tag = element.localName
    if (tag.length > 128) truncated = true
    const row = { index: nodes.length, parentIndex, tag: tag.slice(0, 128), attributes, text, rect, styles }
    const size = new TextEncoder().encode(JSON.stringify(row)).byteLength + 1
    if (bytes + size > 60 * 1024) {
      truncated = true
      byteBudgetExhausted = true
      return
    }
    bytes += size
    nodes.push(row)
    const descendants = [element.childNodes, element.shadowRoot?.childNodes].filter(Boolean) as NodeList[]
    for (const children of descendants) {
      for (let index = 0; index < children.length; index++) {
        if (!consumeWork()) return
        const child = children.item(index)
        if (child.nodeType !== 1) continue
        if (depth >= options.maxDepth || nodes.length >= options.maxNodes || byteBudgetExhausted || bytes >= 60 * 1024) {
          truncated = true
          return
        }
        visit(child as Element, row.index, depth + 1)
      }
    }
  }
  if (root) visit(root, null, 0)
  return { matched: !!root, nodes, truncated }
}
