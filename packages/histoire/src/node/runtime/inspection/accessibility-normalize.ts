/**
 * Axe findings do not include accessible names. Its accessibleText helper
 * requires transient scan-tree state that axe clears after a run; rebuilding
 * that private tree can invoke story getters. Omit accessibleName rather than
 * guessing from attributes such as aria-label, which aria-labelledby can override.
 */
interface AxeNode {
  target?: unknown
  failureSummary?: string
}
interface AxeFinding {
  id: string
  impact?: string | null
  help: string
  helpUrl: string
  nodes: AxeNode[]
}
export interface AxeResults {
  violations: AxeFinding[]
  incomplete: AxeFinding[]
  passes: unknown[]
  inapplicable: unknown[]
}

/** Reduce axe data to bounded findings without HTML or executable values. */
export function normalizeAccessibility(version: string, matched: boolean, results?: AxeResults) {
  let droppedCount = 0
  let retainedNodes = 0
  // Reserve space for envelope, counts and separators before accumulating data.
  let remainingBytes = 36 * 1024
  const encoder = new TextEncoder()
  const normalized = { matched, engine: 'axe-core' as const, engineVersion: version, violations: [] as Array<{ id: string, impact: 'minor' | 'moderate' | 'serious' | 'critical' | null, help: string, helpUrl: string, nodes: Array<{ selectors: string[], failureSummary?: string }> }>, incomplete: [] as typeof normalized.violations, passesCount: results?.passes.length ?? 0, inapplicableCount: results?.inapplicable.length ?? 0, droppedCount: 0, truncated: false }
  /** Process no more than 500 rules and nodes across both outcome lists. */
  for (const kind of ['violations', 'incomplete'] as const) {
    const findings = results?.[kind] ?? []
    for (let index = 0; index < findings.length; index++) {
      if (index >= 500) {
        droppedCount += findings.length - index
        break
      }
      const finding = findings[index]
      let url: URL
      try {
        url = new URL(finding.helpUrl)
      }
      catch {
        droppedCount++
        continue
      }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || typeof finding.id !== 'string' || !finding.id || finding.id.length > 200) {
        droppedCount++
        continue
      }
      const impact = ['minor', 'moderate', 'serious', 'critical'].includes(finding.impact ?? '') ? finding.impact as 'minor' | 'moderate' | 'serious' | 'critical' : null
      const help = String(finding.help)
      if (help.length > 1024 || url.href.length > 2048) droppedCount++
      const item = { id: finding.id, impact, help: help.slice(0, 1024), helpUrl: url.href.slice(0, 2048), nodes: [] as Array<{ selectors: string[], failureSummary?: string }> }
      const itemBytes = encoder.encode(JSON.stringify(item)).byteLength + 8
      if (itemBytes > remainingBytes) {
        droppedCount += 1 + finding.nodes.length
        continue
      }
      remainingBytes -= itemBytes
      for (let nodeIndex = 0; nodeIndex < finding.nodes.length; nodeIndex++) {
        if (retainedNodes >= 500) {
          droppedCount += finding.nodes.length - nodeIndex
          break
        }
        const node = finding.nodes[nodeIndex]
        const selectors = node.target
        // A partial path can point to a different element, especially across frames or shadow roots.
        if (!Array.isArray(selectors) || !selectors.length || selectors.length > 100 || !selectors.every((value): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 512)) {
          droppedCount++
          continue
        }
        if (typeof node.failureSummary === 'string' && node.failureSummary.length > 4096) droppedCount++
        const projected = { selectors, ...(typeof node.failureSummary === 'string' ? { failureSummary: node.failureSummary.slice(0, 4096) } : {}) }
        const size = encoder.encode(JSON.stringify(projected)).byteLength + 1
        if (size > remainingBytes) {
          droppedCount += finding.nodes.length - nodeIndex
          break
        }
        remainingBytes -= size
        item.nodes.push(projected)
        retainedNodes++
      }
      if (item.nodes.length) normalized[kind].push(item)
      else droppedCount++
    }
  }
  /** The complete detached result must fit even when strings are large. */
  while (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > 40 * 1024) {
    const list = normalized.incomplete.length ? normalized.incomplete : normalized.violations
    const last = list.at(-1)
    if (!last) break
    if (last.nodes.length > 1) last.nodes.pop()
    else list.pop()
    droppedCount++
  }
  normalized.droppedCount = droppedCount
  normalized.truncated = droppedCount > 0
  return normalized
}
