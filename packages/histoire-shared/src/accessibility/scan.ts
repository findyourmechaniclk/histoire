import type { AxeResults } from './normalize.js'
import { normalizeAccessibility } from './normalize.js'

/** Browser-safe subset of axe, loaded only by an explicitly enabled runtime. */
export interface AxeEngine {
  /** Actual engine version. */
  version: string
  /** Scan only the supplied story element. */
  run: (root: Element) => Promise<AxeResults>
}
/** Scan controls supplied by the captured runtime owner. */
export interface AccessibilityScanOptions {
  /** Lazy, local engine loader; no external fetch or automatic installation. */
  loadAxe: () => Promise<AxeEngine>
  /** Revalidates exact document and runtime ownership after each asynchronous step. */
  isActive: () => boolean
  /** Optional caller cancellation. */
  signal?: AbortSignal
  /** Deadline in milliseconds, default 10 seconds and maximum 30 seconds. */
  timeoutMs?: number
}

/** The runtime and framework bundles may load separate scanner copies. */
const SCANS_KEY = '__HST_ACCESSIBILITY_SCANS__'
const globals = globalThis as typeof globalThis & { [SCANS_KEY]?: WeakMap<Document, Promise<unknown>> }
const activeScans = globals[SCANS_KEY] ??= new WeakMap()
/** Build a finite error without leaking scanner or document internals. */
function failure(code: string) {
  return Object.assign(new Error(code), { code })
}

/** Run axe inside one story root; non-abortable work retains admission until settled. */
async function runAccessibility<T>(root: Element, selector: string | undefined, options: AccessibilityScanOptions, project: (version: string, matched: boolean, results?: AxeResults) => T) {
  if (selector !== undefined && (typeof selector !== 'string' || !selector || selector.length > 512)) throw failure('INVALID_SELECTOR')
  let selected: Element | null
  try {
    selected = selector ? (root.matches(selector) ? root : root.querySelector(selector)) : root
  }
  catch {
    throw failure('INVALID_SELECTOR')
  }
  const document = root.ownerDocument
  const current = () => options.isActive() && root.isConnected && root.ownerDocument === document && (!selected || root.contains(selected))
  if (options.signal?.aborted) throw failure('CANCELLED')
  if (!current()) throw failure('RUNTIME_CHANGED')
  if (activeScans.has(document)) throw failure('CAPABILITY_UNAVAILABLE')
  const timeoutMs = options.timeoutMs === undefined ? 10000 : options.timeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw failure('INVALID_INPUT')
  let expired = false
  /** Late completion still releases only its own document admission. */
  // Install admission before invoking the loader, including reentrant loaders.
  const job = Promise.resolve().then(async () => {
    let axe: AxeEngine
    try {
      axe = await options.loadAxe()
    }
    catch {
      if (!current()) throw failure('RUNTIME_CHANGED')
      throw failure('CAPABILITY_UNAVAILABLE')
    }
    if (options.signal?.aborted) throw failure('CANCELLED')
    if (expired) throw failure('TIMEOUT')
    if (!current()) throw failure('RUNTIME_CHANGED')
    if (!axe || typeof axe.version !== 'string' || !axe.version || typeof axe.run !== 'function') throw failure('CAPABILITY_UNAVAILABLE')
    if (!selected) return project(axe.version, false)
    let results: AxeResults
    try {
      results = await axe.run(selected)
    }
    catch {
      if (!current()) throw failure('RUNTIME_CHANGED')
      throw failure('INTERNAL_ERROR')
    }
    if (options.signal?.aborted) throw failure('CANCELLED')
    if (expired) throw failure('TIMEOUT')
    if (!current()) throw failure('RUNTIME_CHANGED')
    return project(axe.version, true, results)
  })
  activeScans.set(document, job)
  /** Release only this admitted job after the underlying scan settles. */
  function release() {
    if (activeScans.get(document) === job) activeScans.delete(document)
  }
  void job.then(release, release)
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel: (() => void) | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      expired = true
      reject(failure('TIMEOUT'))
    }, timeoutMs)
    cancel = () => reject(failure('CANCELLED'))
    options.signal?.addEventListener('abort', cancel, { once: true })
    if (options.signal?.aborted) cancel()
  })
  try {
    const result = await Promise.race([job, deadline])
    if (options.signal?.aborted) throw failure('CANCELLED')
    if (!current()) throw failure('RUNTIME_CHANGED')
    return result
  }
  finally {
    clearTimeout(timer)
    if (cancel) options.signal?.removeEventListener('abort', cancel)
  }
}

/** Run bounded inspection using the same admission and ownership as raw consumers. */
export function scanAccessibility(root: Element, selector: string | undefined, options: AccessibilityScanOptions) {
  return runAccessibility(root, selector, options, normalizeAccessibility)
}

/** Keep complete engine results for local assertions, with same final ownership fence. */
export function scanAccessibilityRaw(root: Element, selector: string | undefined, options: AccessibilityScanOptions) {
  return runAccessibility(root, selector, options, (engineVersion, matched, results) => ({ engineVersion, matched, results }))
}

/** Wait for non-abortable work to release document admission without retaining caller listeners. */
export async function waitForAccessibilityScan(document: Document, signal: AbortSignal | undefined, timeoutMs: number): Promise<void> {
  const running = activeScans.get(document)
  if (!running) return
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel: (() => void) | undefined
  try {
    await Promise.race([
      running.catch(() => {}),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(failure('TIMEOUT')), timeoutMs)
        cancel = () => reject(failure('CANCELLED'))
        signal?.addEventListener('abort', cancel, { once: true })
        if (signal?.aborted) cancel()
      }),
    ])
  }
  finally {
    clearTimeout(timer)
    if (cancel) signal?.removeEventListener('abort', cancel)
  }
}
