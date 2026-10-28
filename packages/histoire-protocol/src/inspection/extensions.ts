import { invalid, wireId, wireRecord } from '../bridge/validation.js'

/** Strict extension records prevent silently exposing new fields. */
function record(value: unknown, fields: readonly string[]): Record<string, unknown> {
  const input = wireRecord(value)
  if (Object.keys(input).some(key => !fields.includes(key))) invalid('Unknown inspection extension field')
  return input
}
/** Counts remain exact finite non-negative integers. */
function count(value: unknown): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0) invalid('Invalid inspection count')
}
/** Validate verified relative source metadata without granting editor access. */
function source(value: unknown): void {
  const input = record(value, ['relativePath', 'line', 'column'])
  if (typeof input.relativePath !== 'string' || !input.relativePath || /[\\\0:?#%]/.test(input.relativePath) || input.relativePath.startsWith('/') || input.relativePath.split('/').some(part => !part || part === '.' || part === '..')) invalid('Invalid inspection source')
  for (const key of ['line', 'column']) {
    if (input[key] !== undefined && (!Number.isSafeInteger(input[key]) || (input[key] as number) < 1)) invalid('Invalid source position')
  }
}
/** Instance identity is opaque and scoped to containing result owner. */
function node(value: unknown): Record<string, unknown> {
  const input = record(value, ['id', 'parentId', 'name', 'framework', 'source'])
  if (!wireId(input.id) || !(input.parentId === null || wireId(input.parentId)) || typeof input.name !== 'string' || typeof input.framework !== 'string') invalid('Invalid component node')
  if (input.source !== undefined) source(input.source)
  return input
}
/** Selectors are bounded data, not executable callbacks. */
function selectors(value: unknown): void {
  if (!Array.isArray(value) || value.length > 100 || value.some(item => typeof item !== 'string' || !item || item.length > 512)) invalid('Invalid element selectors')
}
/** Validate framework tree or selected instance details after common JSON budget. */
export function validateComponentExtension(input: Record<string, unknown>, base: string[]): void {
  const coverage = ['coverage', 'limitations']
  const limitations = ['fragment', 'slot', 'teleport', 'async', 'keep-alive', 'framework-metadata', 'source']
  if (!['complete', 'partial'].includes(input.coverage as string) || !Array.isArray(input.limitations) || input.limitations.length > limitations.length || input.limitations.some(item => !limitations.includes(item)) || new Set(input.limitations).size !== input.limitations.length || (input.coverage === 'complete' && input.limitations.length)) invalid('Invalid component coverage')
  if (input.inspection === 'components') {
    record(input, [...base, ...coverage, 'nodes', 'omittedCount'])
    count(input.omittedCount)
    if (!Array.isArray(input.nodes) || input.nodes.length > 500) invalid('Invalid component tree')
    const seen = new Set<string>()
    const depth = new Map<string, number>()
    for (const value of input.nodes) {
      const current = node(value)
      if (seen.has(current.id as string) || (current.parentId !== null && !seen.has(current.parentId as string))) invalid('Invalid component tree ownership')
      const level = current.parentId === null ? 0 : depth.get(current.parentId as string)! + 1
      if (level > 20) invalid('Component depth exceeded')
      seen.add(current.id as string)
      depth.set(current.id as string, level)
    }
  }
  else if (input.inspection === 'componentForElement') {
    record(input, [...base, ...coverage, 'matched', 'node', 'unavailableReason'])
    if (typeof input.matched !== 'boolean' || (input.node !== null && !input.matched) || (input.unavailableReason !== undefined && !['owner-unavailable', 'outside-owned-root'].includes(input.unavailableReason as string)) || (input.node !== null && input.unavailableReason !== undefined) || (input.matched && input.node === null && input.unavailableReason === undefined) || (!input.matched && input.unavailableReason !== undefined)) invalid('Invalid element ownership result')
    if (input.node !== null) node(input.node)
  }
  else {
    record(input, [...base, ...coverage, 'node', 'props', 'state', 'selectors', 'omittedValues'])
    node(input.node)
    wireRecord(input.props)
    if (input.state !== undefined) wireRecord(input.state)
    selectors(input.selectors)
    count(input.omittedValues)
  }
}
/** Bounded findings omit raw HTML and executable axe configuration. */
export function validateAccessibilityExtension(input: Record<string, unknown>, base: string[]): void {
  record(input, [...base, 'matched', 'engine', 'engineVersion', 'violations', 'incomplete', 'passesCount', 'inapplicableCount', 'droppedCount'])
  if (typeof input.matched !== 'boolean' || input.engine !== 'axe-core' || !wireId(input.engineVersion)) invalid('Invalid accessibility engine')
  for (const key of ['passesCount', 'inapplicableCount', 'droppedCount']) count(input[key])
  let retained = 0
  for (const key of ['violations', 'incomplete']) {
    const rows = input[key]
    if (!Array.isArray(rows) || rows.length > 500) invalid('Invalid accessibility findings')
    for (const value of rows) {
      const finding = record(value, ['id', 'impact', 'help', 'helpUrl', 'nodes'])
      if (!wireId(finding.id) || ![null, 'minor', 'moderate', 'serious', 'critical'].includes(finding.impact as string) || typeof finding.help !== 'string' || typeof finding.helpUrl !== 'string') invalid('Invalid accessibility rule')
      let url: URL
      try {
        url = new URL(finding.helpUrl)
      }
      catch { return invalid('Invalid accessibility help URL') }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) invalid('Invalid accessibility help URL')
      if (!Array.isArray(finding.nodes)) invalid('Invalid accessibility nodes')
      for (const value of finding.nodes) {
        if (++retained > 500) invalid('Accessibility node limit exceeded')
        const item = record(value, ['selectors', 'failureSummary', 'accessibleName'])
        selectors(item.selectors)
        if (item.accessibleName !== undefined && (typeof item.accessibleName !== 'string' || item.accessibleName.length > 1024)) invalid('Invalid accessible name')
        if (item.failureSummary !== undefined && (typeof item.failureSummary !== 'string' || item.failureSummary.length > 4096)) invalid('Invalid accessibility summary')
      }
    }
  }
  if (!input.matched && ((input.violations as unknown[]).length || (input.incomplete as unknown[]).length)) invalid('Unmatched audit cannot contain findings')
}
