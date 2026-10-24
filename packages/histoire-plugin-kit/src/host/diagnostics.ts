import type { PluginDiagnostic } from '../types/host.js'

/** Append-only diagnostics log of one host. Failures are recorded, never retried. */
export interface DiagnosticsLog {
  /** Records a diagnostic unless the same error object was already recorded for the plugin. */
  record: (diagnostic: PluginDiagnostic) => void
  /** Frozen snapshot; identity changes only when a diagnostic is added. */
  list: () => ReadonlyArray<PluginDiagnostic>
}

/**
 * Creates a diagnostics log.
 * @param onChange Called after each new diagnostic.
 */
export function createDiagnosticsLog(onChange: () => void): DiagnosticsLog {
  let snapshot: ReadonlyArray<PluginDiagnostic> = Object.freeze([])

  /**
   * Whether `diagnostic` repeats an error already attributed to the same plugin, e.g. a
   * rejected registration rethrown out of `setup`.
   * @param diagnostic Candidate entry.
   */
  function isRepeat(diagnostic: PluginDiagnostic): boolean {
    const { error, pluginId } = diagnostic
    return typeof error === 'object' && error !== null
      && snapshot.some(entry => entry.pluginId === pluginId && entry.error === error)
  }

  return {
    record(diagnostic) {
      if (isRepeat(diagnostic)) return
      snapshot = Object.freeze([...snapshot, Object.freeze({ ...diagnostic })])
      onChange()
    },
    list: () => snapshot,
  }
}
