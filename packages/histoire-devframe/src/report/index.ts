import type { HistoireInspectionResult } from '@histoire/protocol'
import type { InspectionContentOptions, InspectionReportContent } from './content.js'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { validateInspectionResult } from '@histoire/protocol'
import { selectReportContent } from './content.js'

export type { InspectionContentOptions, InspectionReportContent } from './content.js'

/** Credential-free historical identity represented by stable SHA-256 fingerprints. */
export interface InspectionReportEntryBase {
  /** Runtime or isolated origin of the observation. */
  mode: 'live' | 'isolated'
  /** Original observation time in UTC. */
  observedAt: string
  /** Fingerprint of source identity. */
  source: string
  /** Fingerprint of source epoch. */
  epoch: string
  /** Fingerprint of source revision. */
  revision: string
  /** Fingerprint of runtime document identity. */
  runtime: string
  /** Fingerprint of story identity. */
  story: string
  /** Fingerprint of variant identity. */
  variant: string
  /** Explicitly selected caller-sanitized content, absent by default. */
  content?: InspectionReportContent
  /** Inspection was truncated. */
  truncated: boolean
}

/** Summary fields are always present; selected sanitized content is optional. */
export type InspectionReportEntry = InspectionReportEntryBase & (
  | { inspection: 'variant', stateFields: number, components: number, omittedValues: number }
  | { inspection: 'dom', matched: boolean, elements: number }
)

/** Versioned detached historical summary. */
export interface InspectionReport {
  /** Report format version. */
  version: 1
  /** UTC export timestamp. */
  generatedAt: string
  /** Explicitly selected bounded summaries. */
  entries: InspectionReportEntry[]
}

/** Produces a one-way, consistently encoded identifier without storing its original text. */
function fingerprint(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** Map one validated result to a metadata-only summary. */
function summarize(result: HistoireInspectionResult): InspectionReportEntry {
  if (result.inspection !== 'variant' && result.inspection !== 'dom') throw new Error('Unsupported inspection report result')
  const { owner } = result
  const base: InspectionReportEntryBase = {
    mode: result.mode,
    observedAt: new Date(result.observedAt).toISOString(),
    source: fingerprint(owner.sourceId),
    epoch: fingerprint(owner.epoch),
    revision: fingerprint(owner.revision),
    runtime: fingerprint(owner.runtimeId),
    story: fingerprint(owner.target.storyId),
    variant: fingerprint(owner.target.variantId),
    truncated: result.truncated,
  }
  return result.inspection === 'variant'
    ? { ...base, inspection: 'variant', stateFields: Object.keys(result.state).length, components: result.components.length, omittedValues: result.omittedValues }
    : { ...base, inspection: 'dom', matched: result.matched, elements: result.nodes.length }
}

/** Escape all data interpolated into offline HTML. */
function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll('\'', '&#39;')
}

/** Render static HTML without scripts, network dependencies, or live commands. */
function renderReport(data: InspectionReport): string {
  const rows = data.entries.map((entry) => {
    const summary = entry.inspection === 'variant'
      ? `${entry.stateFields} state fields, ${entry.components} prop groups, ${entry.omittedValues} omitted values`
      : entry.matched ? `${entry.elements} elements` : 'No matching element'
    const cells = [entry.observedAt, entry.mode, entry.inspection, entry.source, entry.epoch, entry.revision, entry.runtime, entry.story, entry.variant, summary, entry.truncated ? 'Yes' : 'No']
    const content = entry.content ? `<pre>${escapeHtml(JSON.stringify(entry.content, null, 2))}</pre>` : ''
    return `<tr>${cells.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}<td>${content}</td></tr>`
  }).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'"><title>Historical inspection</title></head><body><h1>Historical inspection</h1><p>Exported ${escapeHtml(data.generatedAt)}. Identity values are SHA-256 fingerprints. Selected content is caller-sanitized and may contain sensitive information.</p><table><thead><tr><th>Observed</th><th>Mode</th><th>Kind</th><th>Source</th><th>Epoch</th><th>Revision</th><th>Runtime</th><th>Story</th><th>Variant</th><th>Summary</th><th>Truncated</th><th>Selected content</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
}

/**
 * Explicitly export selected validated results as detached metadata and standalone HTML.
 * Rejects oversized or unsupported results; does not read sessions or write files.
 * @param options Report input.
 * @param options.results Results the caller intentionally selected.
 * @param options.content Optional explicitly selected content with caller-provided sanitization.
 */
export function createInspectionReport(options: { results: readonly unknown[], content?: InspectionContentOptions }): { data: InspectionReport, html: string } {
  const descriptor = options && Object.getOwnPropertyDescriptor(options, 'results')
  const results = descriptor && 'value' in descriptor ? descriptor.value : undefined
  if (!Array.isArray(results) || results.length > 32) throw new Error('Inspection report accepts at most 32 results')
  const resultsValidated: HistoireInspectionResult[] = []
  for (let index = 0; index < results.length; index++) {
    const item = Object.getOwnPropertyDescriptor(results, index)
    if (!item || !('value' in item)) throw new Error('Inspection report requires detached results')
    resultsValidated.push(validateInspectionResult(item.value))
  }
  const entries = resultsValidated.map(summarize)
  const contentDescriptor = Object.getOwnPropertyDescriptor(options, 'content')
  if (contentDescriptor) {
    if (!('value' in contentDescriptor)) throw new Error('Report content must be a detached option')
    const content = selectReportContent(contentDescriptor.value, resultsValidated)
    for (const [index, selected] of content) entries[index].content = selected
  }
  const data: InspectionReport = { version: 1, generatedAt: new Date().toISOString(), entries }
  const html = renderReport(data)
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 64 * 1024 || Buffer.byteLength(html, 'utf8') > 64 * 1024) throw new Error('Inspection report exceeds size limit')
  return { data, html }
}
