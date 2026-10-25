import type { FrameSnapshotCapture } from './capture.js'

/** Escapes text for a double-quoted attribute value. */
function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

/** Serializes an attribute record. */
function renderAttributes(attributes: Record<string, string>): string {
  return Object.entries(attributes).map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join('')
}

/**
 * Builds the `srcdoc` of a snapshot frame.
 * @param snapshot Captured markup and attributes
 * @param css Stylesheet text of the captured document. Inlined: its relative
 * `url()`s must resolve against the sandbox URL, like in the live document.
 * @param baseUrl Sandbox URL that relative asset URLs resolve against
 */
export function renderFrameSnapshot(snapshot: Pick<FrameSnapshotCapture, 'htmlAttributes' | 'bodyAttributes' | 'body'>, css: string, baseUrl: string): string {
  // Stylesheet text could otherwise end its own `<style>` element.
  const style = css.replaceAll(/<\/style/gi, '<\\/style')
  return `<!DOCTYPE html><html${renderAttributes(snapshot.htmlAttributes)}><head><meta charset="utf-8"><base href="${escapeAttribute(baseUrl)}"><style>${style}</style></head><body${renderAttributes(snapshot.bodyAttributes)}>${snapshot.body}</body></html>`
}
