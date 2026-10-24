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

/** Legacy boolean query flag that older hosts and runtime checks still use per purpose. */
const LEGACY_PURPOSE_FLAGS: Partial<Record<HistoireFramePurpose, string>> = {
  'test-worker': 'testWorker',
  'controls': 'controls',
}

/** Narrows an arbitrary query value to a known purpose. */
function isFramePurpose(value: string | null): value is HistoireFramePurpose {
  return FRAME_PURPOSES.includes(value as HistoireFramePurpose)
}

/**
 * Marks a story frame document URL with its purpose, plus the legacy flag the
 * runtime still reads for that purpose (`controls=true`, `testWorker=true`).
 */
export function setFramePurpose(url: URL, purpose: HistoireFramePurpose): void {
  url.searchParams.set(FRAME_PURPOSE_PARAM, purpose)
  const legacyFlag = LEGACY_PURPOSE_FLAGS[purpose]
  if (legacyFlag) url.searchParams.set(legacyFlag, 'true')
}

/**
 * Reads the purpose of a story frame document from its query. An explicit known
 * `purpose` wins; otherwise legacy flags are mapped (`controls=true`,
 * `testWorker=true`, an MCP nonce), and anything else is `interactive`.
 * `matrix=true` is a presentation flag, so Matrix cells stay `interactive`.
 */
export function getFramePurpose(query: URLSearchParams): HistoireFramePurpose {
  const explicit = query.get(FRAME_PURPOSE_PARAM)
  if (isFramePurpose(explicit)) return explicit
  if (query.get('controls') === 'true') return 'controls'
  if (query.get('testWorker') === 'true') return 'test-worker'
  if (query.has('mcpNonce')) return 'automation'
  return 'interactive'
}

/** True for documents a person interacts with, the only ones eligible for frame plugins. */
export function isInteractiveFramePurpose(purpose: HistoireFramePurpose): boolean {
  return purpose === 'interactive'
}
