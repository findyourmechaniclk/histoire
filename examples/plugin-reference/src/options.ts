// Shared by the Node factory, the workbench module and the frame module: framework-free.

/** Plugin id shared by the Node descriptor, workbench and frame modules. */
export const REFERENCE_PLUGIN_ID = 'reference'

/** Browser-visible options, passed as the descriptor's JSON `options`. */
export interface ReferenceOptions {
  /** Smallest interactive target size, in CSS pixels, before the audit reports it. */
  minTargetSize: number
}

/** Defaults applied when an option is absent or invalid. */
export const DEFAULT_REFERENCE_OPTIONS: Readonly<ReferenceOptions> = Object.freeze({ minTargetSize: 24 })

/**
 * Reads browser-visible options defensively: the descriptor is JSON, so anything may arrive.
 * @param value `api.options` (workbench) or `frame.options` (frame).
 */
export function normalizeReferenceOptions(value: unknown): ReferenceOptions {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const size = input.minTargetSize
  return {
    minTargetSize: typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : DEFAULT_REFERENCE_OPTIONS.minTargetSize,
  }
}
