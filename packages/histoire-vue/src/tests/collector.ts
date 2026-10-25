import type { HistoireSession } from '@histoire/sdk'
import type { HistoireTestsModel } from './model.js'

/** Options of {@link createHistoireTestsCollector}. */
export interface HistoireTestsCollectorOptions {
  /**
   * Schedules each automatic collection, e.g. after other startup work.
   * Returns a cancel function, called when the target changes first.
   */
  defer?: (run: () => void) => () => void
}

/** Owns automatic definition collection for one first-party Tests surface. */
export function createHistoireTestsCollector(session: HistoireSession, model: HistoireTestsModel, options: HistoireTestsCollectorOptions = {}) {
  let active = true
  let owner: string | null = null
  let cancelPending = () => {}

  /** Starts the collection of the current target. */
  function collect(): void {
    void model.controller.collect().catch(() => {
      // Controller publishes attributable collection failures. Navigation and
      // retired runtime replies must never escape as unhandled rejections.
    })
  }

  /** Collects once for each exact ready source, target, and runtime identity. */
  function synchronize(): void {
    const snapshot = session.getSnapshot()
    if (!active) return
    if (snapshot.status !== 'ready' || snapshot.stale || snapshot.runtime.status !== 'ready' || !snapshot.selection?.variantId || !snapshot.capabilities.previewTests.available) {
      owner = null
      cancelPending()
      return
    }

    const current = JSON.stringify([snapshot.source, snapshot.selection, snapshot.runtime.runtimeId])
    if (current === owner) return
    owner = current
    cancelPending()
    if (!options.defer) {
      collect()
      return
    }
    cancelPending = options.defer(() => {
      cancelPending = () => {}
      if (active && owner === current) collect()
    })
  }

  const stop = session.subscribe(synchronize)
  synchronize()

  return {
    /** Stops observation and retires in-flight panel work exactly once. */
    close(): void {
      if (!active) return
      active = false
      stop()
      cancelPending()
      model.controller.close()
    },
  }
}
