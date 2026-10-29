import type { AxeResults, RunOptions } from 'axe-core'
import type { A11yScanOptions } from '../options.js'
import { normalizeAccessibility, scanAccessibilityRaw, waitForAccessibilityScan } from '@histoire/shared/accessibility'
import { normalizeOptions } from '../options.js'

/** Recovery guidance for shared scanner's finite error codes. */
const SCAN_ERRORS: Record<string, string> = {
  TIMEOUT: 'Accessibility check timed out. Run checks again or increase timeoutMs.',
  CAPABILITY_UNAVAILABLE: 'Another accessibility check is still running. Try again shortly.',
  RUNTIME_CHANGED: 'Variant changed during accessibility check. Run checks again.',
  CANCELLED: 'Accessibility check cancelled.',
  INTERNAL_ERROR: 'Accessibility check failed. Run checks again.',
}

/** Exact private element references retained for one completed report. */
export type AuditElements = Map<string, Element>

/** Stable key correlating bounded finding to private raw node reference. */
export function nodeKey(kind: string, rule: string, selectors: readonly string[]): string {
  return JSON.stringify([kind, rule, selectors])
}

/** Scan one owned root; retain raw results locally for complete CLI failure policy. */
export async function runAudit(root: HTMLElement, input: A11yScanOptions = {}, signal?: AbortSignal) {
  const options = normalizeOptions(input)
  let raw: AxeResults | undefined
  const elements: AuditElements = new Map()
  let detail: unknown
  const capturedDocument = root.ownerDocument
  try {
    const started = performance.now()
    await waitForAccessibilityScan(capturedDocument, signal, options.timeoutMs)
    const result = await scanAccessibilityRaw(root, undefined, {
      signal,
      timeoutMs: Math.max(1, options.timeoutMs - (performance.now() - started)),
      isActive: () => root.isConnected && root.ownerDocument === capturedDocument,
      loadAxe: async () => {
        let axe: typeof import('axe-core')
        try {
          axe = (await import('virtual:histoire-a11y-axe')).default
        }
        catch (error) {
          detail = error
          throw error
        }
        const rules = new Set(axe.getRules().map(rule => rule.ruleId))
        for (const name of Object.keys(options.axe?.rules ?? {})) {
          if (!rules.has(name)) {
            detail = new Error(`Unknown axe rule: ${name}`)
            throw detail
          }
        }
        return {
          version: axe.version,
          async run() {
            try {
              const excluded = options.exclude.flatMap(selector => [
                ...root.matches(selector) ? [root] : [],
                ...root.querySelectorAll(selector),
              ])
              const runOptions: RunOptions = { ...options.axe, elementRef: true }
              // A root exclusion means no eligible content, not a fallback to document.
              const scanned: AxeResults = excluded.includes(root)
                ? { violations: [], incomplete: [], passes: [], inapplicable: [], testEngine: { name: 'axe-core', version: axe.version } } as unknown as AxeResults
                : await axe.run({ include: [root], exclude: excluded }, runOptions)
              raw = scanned
              for (const kind of ['violations', 'incomplete'] as const) {
                for (const rule of scanned[kind]) {
                  for (const node of rule.nodes) {
                    const element = node.element
                    if (element && root.contains(element)) elements.set(nodeKey(kind, rule.id, node.target as string[]), element)
                  }
                }
              }
              return scanned
            }
            catch (error) {
              detail = error
              throw error
            }
          },
        }
      },
    })
    const report = { ...normalizeAccessibility(result.engineVersion, result.matched, result.results), violationsCount: raw!.violations.length, incompleteCount: raw!.incomplete.length }
    const retained: AuditElements = new Map()
    // Keep DOM handles only for bounded, visible findings; raw policy data is short-lived.
    for (const kind of ['violations', 'incomplete'] as const) {
      for (const rule of report[kind]) {
        for (const node of rule.nodes) {
          const key = nodeKey(kind, rule.id, node.selectors)
          const element = elements.get(key)
          if (element) retained.set(key, element)
        }
      }
    }
    return { report, raw: raw!, elements: retained }
  }
  catch (error) {
    if (detail) throw new Error(`Accessibility scan failed: ${detail instanceof Error ? detail.message : String(detail)}`, { cause: error })
    const code = (error as { code?: string })?.code
    if (code && SCAN_ERRORS[code]) throw new Error(SCAN_ERRORS[code], { cause: error })
    throw error
  }
}
