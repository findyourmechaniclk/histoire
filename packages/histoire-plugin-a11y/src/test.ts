import type { A11yTestOptions } from './options.js'
import { pushHistoireTestRegistration, registerCollectedTestCase } from '@histoire/shared'
import { evaluateResults } from './scanner/policy.js'
import { runAudit } from './scanner/run.js'

export type { A11yTestOptions } from './options.js'

/** Assert accessibility of current story state, independent of workbench preferences. */
export async function assertA11y(canvas: HTMLElement, options: A11yTestOptions = {}): Promise<void> {
  const result = await runAudit(canvas, options)
  const policy = evaluateResults(result.raw, options.minimumImpact)
  // eslint-disable-next-line no-console -- Informational CLI findings are distinct from failed assertions.
  if (policy.review || policy.belowThreshold) console.info(`[Accessibility] ${policy.review} rules need review; ${policy.belowThreshold} violations below failure threshold`)
  if (policy.failed) throw new Error(`${policy.failed} accessibility ${policy.failed === 1 ? 'violation' : 'violations'}\n\n${policy.message}`)
}

/** Register one isolated test; called by generated framework setup hooks. Never scans during discovery. */
export function registerA11yTests(options: A11yTestOptions): void {
  pushHistoireTestRegistration(({ canvas }) => {
    registerCollectedTestCase('Accessibility (axe-core)', () => assertA11y(canvas, options), (options.timeoutMs ?? 10000) + 1000)
  })
}
