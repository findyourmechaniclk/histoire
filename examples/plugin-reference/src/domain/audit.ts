// Framework-free audit of one rendered variant. Runs inside story frames.
import type { ReferenceOptions } from '../options.js'

/** Rules reported by the audit. */
export type AuditRule = 'missing-alt' | 'unnamed-control' | 'small-target'

/** One finding; plain JSON so it can cross the plugin channel. */
// eslint-disable-next-line ts/consistent-type-definitions -- JSON payload: an interface lacks the index signature `HistoireJsonValue` needs
export type AuditIssue = {
  /** Rule that produced the finding. */
  rule: AuditRule
  /** Short element description (`tag#id.class`). */
  element: string
  /** Detail shown next to the rule. */
  message: string
}

/** Audit result of one rendered variant; plain JSON. */
// eslint-disable-next-line ts/consistent-type-definitions -- JSON payload: an interface lacks the index signature `HistoireJsonValue` needs
export type AuditReport = {
  /** Elements below the variant root. */
  nodes: number
  /** Findings in document order per rule. */
  issues: AuditIssue[]
}

/** Report plus the audited elements, index-aligned with `report.issues`. */
export interface AuditResult {
  /** Channel-safe report. */
  report: AuditReport
  /** Element of each issue; stays in the frame. */
  elements: Element[]
}

/** Elements users can activate. */
const INTERACTIVE = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]'
/** Controls that need an accessible name. */
const NAMED_CONTROLS = 'button, a[href], [role="button"]'

/**
 * Describes an element for display: tag, id and up to two classes.
 * @param element Audited element.
 */
export function describeElement(element: Element): string {
  const id = element.id ? `#${element.id}` : ''
  const classes = [...element.classList].slice(0, 2).map(name => `.${name}`).join('')
  return `${element.tagName.toLowerCase()}${id}${classes}`
}

/**
 * Whether a control exposes a name: label attributes, text, or an image with alt text.
 * @param element Control element.
 */
function hasAccessibleName(element: Element): boolean {
  if (element.getAttribute('aria-label')?.trim() || element.getAttribute('aria-labelledby') || element.getAttribute('title')?.trim()) return true
  if (element.textContent?.trim()) return true
  return [...element.querySelectorAll('img[alt]')].some(image => image.getAttribute('alt')?.trim())
}

/**
 * Audits a rendered variant root.
 * @param root Rendered variant root element.
 * @param options Normalized plugin options.
 */
export function auditElement(root: Element, options: ReferenceOptions): AuditResult {
  const issues: AuditIssue[] = []
  const elements: Element[] = []
  /** Records one finding with its element. */
  const add = (rule: AuditRule, element: Element, message: string) => {
    issues.push({ rule, element: describeElement(element), message })
    elements.push(element)
  }
  for (const image of root.querySelectorAll('img:not([alt])')) add('missing-alt', image, 'Image without alt text')
  for (const control of root.querySelectorAll(NAMED_CONTROLS)) {
    if (!hasAccessibleName(control)) add('unnamed-control', control, 'Control without accessible name')
  }
  if (options.minTargetSize > 0) {
    for (const target of root.querySelectorAll(INTERACTIVE)) {
      const { width, height } = target.getBoundingClientRect()
      // Unrendered (hidden, detached, zero-size) targets cannot be hit, so they are not reported.
      if (width === 0 && height === 0) continue
      if (width < options.minTargetSize || height < options.minTargetSize) {
        add('small-target', target, `${Math.round(width)}×${Math.round(height)} px, below ${options.minTargetSize} px`)
      }
    }
  }
  return { report: { nodes: root.querySelectorAll('*').length, issues }, elements }
}
