// Everything one plugin instance shares between contributions and views. Framework-free.
import type { WorkbenchPluginApi } from '@histoire/plugin-kit'
import type { ReferenceOptions } from '../options.js'
import { normalizeReferenceOptions } from '../options.js'
import { createAnnotationDraft } from './annotation-draft.js'
import { createAuditStore } from './audit-store.js'
import { createReferencePreferences } from './preferences.js'
import { createTitles } from './titles.js'

/**
 * Creates the state of one plugin instance (one per extension host, so two workbenches on a
 * page never share it). Views receive it from their framework adapter.
 * @param api Plugin API passed to `setup`.
 */
export function createReferenceModel(api: WorkbenchPluginApi) {
  const preferences = createReferencePreferences(api.preferences)
  return {
    /** Normalized browser-visible options. */
    options: normalizeReferenceOptions(api.options) as Readonly<ReferenceOptions>,
    /** Frame reports. */
    audits: createAuditStore(api),
    /** Per-user preferences. */
    preferences,
    /** Readable frame names. */
    titles: createTitles(api.context),
    /** Annotation being drawn. */
    draft: createAnnotationDraft(preferences),
  }
}

/** Shared state of one plugin instance. */
export type ReferenceModel = ReturnType<typeof createReferenceModel>
