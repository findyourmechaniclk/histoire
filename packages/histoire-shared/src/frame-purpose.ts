/**
 * Why a story frame document (`__sandbox.html`) exists. Optional runtime
 * features (frame plugins, for instance) decide their eligibility from it.
 *
 * - `interactive`: visible primary runtime, canvas replica or Matrix cell.
 * - `test-worker`: hidden in-book document running one test case.
 * - `automation`: MCP or screenshot capture document.
 * - `controls`: replica rendering only a story's custom controls slot.
 */
export type HistoireFramePurpose = 'interactive' | 'test-worker' | 'automation' | 'controls'

/** Query parameter carrying the purpose of a story frame document. */
export const FRAME_PURPOSE_PARAM = 'purpose'

/** Every known purpose, used to reject unknown query values. */
const FRAME_PURPOSES: readonly HistoireFramePurpose[] = ['interactive', 'test-worker', 'automation', 'controls']

/** Narrows an arbitrary query value to a known purpose. */
function isFramePurpose(value: string | null): value is HistoireFramePurpose {
  return FRAME_PURPOSES.includes(value as HistoireFramePurpose)
}

/** Marks a story frame document URL with its purpose. */
export function setFramePurpose(url: URL, purpose: HistoireFramePurpose): void {
  url.searchParams.set(FRAME_PURPOSE_PARAM, purpose)
}

/**
 * Reads the purpose of a story frame document from its query. A missing or
 * unknown `purpose` is `interactive`; `matrix=true` is a presentation flag, so
 * Matrix cells stay `interactive`.
 */
export function getFramePurpose(query: URLSearchParams): HistoireFramePurpose {
  const explicit = query.get(FRAME_PURPOSE_PARAM)
  return isFramePurpose(explicit) ? explicit : 'interactive'
}

/** True for documents a person interacts with, the only ones eligible for frame plugins. */
export function isInteractiveFramePurpose(purpose: HistoireFramePurpose): boolean {
  return purpose === 'interactive'
}
