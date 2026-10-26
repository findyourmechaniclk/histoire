import type { HistoirePreparedSource } from './content.js'
import { h } from 'vue'

/** Render source safely while letting host classes reach Shiki's generated pre element. */
export function renderSourceContent(value: HistoirePreparedSource, preClass?: string) {
  if (value.html === null) return h('div', { class: 'histoire-source-content' }, h('pre', { class: preClass }, value.content.body))
  // Shiki owns this markup and always emits a quoted class on pre. Escape the
  // host's attribute value, never alter the escaped source text inside code.
  const escapedClass = preClass?.replace(/[&"<>]/g, character => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[character]!)
  const html = escapedClass ? value.html.replace(/(<pre\s+class=")/, prefix => `${prefix}${escapedClass} `) : value.html
  return h('div', { class: 'histoire-source-content' }, h('div', { innerHTML: html }))
}
