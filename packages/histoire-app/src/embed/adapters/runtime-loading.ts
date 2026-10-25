/** Failed document loads retried before the frame waits for its readiness timeout. */
const MAX_DOCUMENT_RETRIES = 3

/** Recovery of documents whose request failed and left the browser's error page. */
export interface RuntimeDocumentFailure {
  /** Whether the loaded document is the browser's (cross-origin) error page. */
  failed: () => boolean
  /** Opens a fresh document for current intent. */
  renavigate: () => void
}

/**
 * Distinguish expected document navigation from recovery of a retained physical sandbox.
 * @param settings Resends presentation settings on every load.
 * @param version Current selection version, or `null` when the frame restores nothing.
 * @param recover Restores current intent into a reloaded document under a new version.
 * @param resync Posts current intent again, without a new version.
 * @param failure Detects and replaces documents whose request failed.
 */
export function createRuntimeLoadRecovery(settings: () => void, version: () => number | null, recover: () => void, resync: () => void, failure?: RuntimeDocumentFailure) {
  let initial = true
  let restoring = false
  let failures = 0
  let retry: ReturnType<typeof setTimeout> | undefined
  return {
    /** Parent assigned a new src; its matching bootstrap already owns first load. */
    navigate() {
      initial = true
      restoring = false
    },
    /** Only later loads, or changed intent during navigation, need selection restoration. */
    loaded() {
      if (failure?.failed()) {
        // Same-origin sandboxes are always readable; an error page runs no
        // Histoire script that could report or recover. Back off 0.5, 1.5, 4.5 s.
        if (failures < MAX_DOCUMENT_RETRIES) retry = setTimeout(failure.renavigate, 500 * 3 ** failures++)
        return
      }
      settings()
      const current = version()
      if (current === null) return
      if (initial) {
        initial = false
        if (current === 0) return
      }
      restoring = true
      recover()
    },
    /**
     * The reloaded document reported readiness under an older version: it
     * missed the restored intent, posted on `load` before its runtime listened.
     */
    missed() {
      if (restoring) resync()
    },
    /** Current intent acknowledged; later stale reports are ordinary queued predecessors. */
    restored() {
      restoring = false
      failures = 0
    },
    /** Cancels a scheduled document retry. */
    dispose() {
      clearTimeout(retry)
    },
  }
}
