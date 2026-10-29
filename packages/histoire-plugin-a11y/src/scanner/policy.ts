import type { AxeResults } from 'axe-core'
import type { A11yImpact } from '../options.js'

/** Severity weights shared by filtering and test policy. */
export const IMPACTS: Readonly<Record<A11yImpact, number>> = { minor: 1, moderate: 2, serious: 3, critical: 4 }

/** Evaluate complete axe output before bounding human-readable failure diagnostics. */
export function evaluateResults(results: Pick<AxeResults, 'violations' | 'incomplete'>, minimumImpact?: A11yImpact) {
  if (minimumImpact !== undefined && !Object.hasOwn(IMPACTS, minimumImpact)) throw new Error('[HstA11y] Invalid minimumImpact')
  const failing = results.violations.filter(rule => !minimumImpact || !rule.impact || (IMPACTS[rule.impact as A11yImpact] ?? 4) >= IMPACTS[minimumImpact])
  const lines: string[] = []
  let remaining = 12000
  let omitted = 0
  for (const rule of failing) {
    const heading = `${rule.id} [${rule.impact ?? 'unknown'}]: ${rule.help}\n${rule.helpUrl}`
    const details = rule.nodes.map(node => `${JSON.stringify(node.target)}${node.failureSummary ? `\n${node.failureSummary}` : ''}`)
    const text = [heading, ...details].join('\n')
    if (remaining < 300) {
      omitted++
      continue
    }
    const bounded = text.slice(0, Math.min(remaining, 2000))
    lines.push(bounded + (bounded.length < text.length ? '\nAdditional element details omitted' : ''))
    remaining -= bounded.length
  }
  if (omitted) lines.push(`${omitted} additional failing rules omitted`)
  return { failed: failing.length, belowThreshold: results.violations.length - failing.length, review: results.incomplete.length, message: lines.join('\n\n') }
}
