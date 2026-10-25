import type { HistoireSession } from '@histoire/sdk'
import type { HistoireTestsCollectorOptions, HistoireTestsModel } from '@histoire/vue/internal'
import { createHistoireTestsCollector } from '@histoire/vue/internal'

/** Standalone preserves automatic definition collection, never automatic execution. */
export function createStandaloneTests(session: HistoireSession, model: HistoireTestsModel, options?: HistoireTestsCollectorOptions) {
  const collector = createHistoireTestsCollector(session, model, options)
  return {
    /** Model remains provider-scoped, with no standalone store or active global. */
    model,
    /** Adapter owns collection subscription plus single controller cancellation. */
    close: collector.close,
  }
}
