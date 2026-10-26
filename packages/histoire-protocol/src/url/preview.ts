/** Inputs shared by browser UI and MCP sandbox links. */
export interface SandboxUrlOptions {
  /** Deployment base, including optional trailing slash. */
  base: string
  /** Exact collected story identity. */
  storyId: string
  /** Exact variant identity. */
  variantId: string
}

/** Canonical deployment base must remain on the current origin. */
export function normalizePreviewBase(value: string): string {
  const base = value.endsWith('/') ? value : `${value}/`
  const segments = base.split('/').map(segment => segment.replace(/%2e/gi, '.'))
  if (!base.startsWith('/') || base.startsWith('//') || /[?#\\\0]/.test(base) || !base.isWellFormed() || segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error('Preview base must be a same-origin absolute path')
  }
  return base
}

/** Build a relative sandbox URL with exact identities in query parameters. */
export function getSandboxRelativeUrl(options: SandboxUrlOptions): string {
  const query = new URLSearchParams({ storyId: options.storyId, variantId: options.variantId })
  const base = normalizePreviewBase(options.base)
  return `${base}__sandbox.html?${query}`
}
