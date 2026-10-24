// Readable names for frame targets, from the metadata-only catalog. Framework-free.
import type { Disposer, WorkbenchContext } from '@histoire/plugin-kit'
import type { HistoireTarget } from '@histoire/protocol'

/**
 * Map key of a target.
 * @param target Story and variant.
 */
function getTargetKey(target: HistoireTarget): string {
  return JSON.stringify([target.storyId, target.variantId])
}

/**
 * Lazily loaded `Story › Variant` titles. The catalog loads on first use and again after a root
 * context change (new selection or source), so titles follow story edits in dev.
 * @param context Root context (`api.context`), owned by the plugin.
 */
export function createTitles(context: WorkbenchContext) {
  let titles = new Map<string, string>()
  let loading: Promise<void> | undefined
  const listeners = new Set<() => void>()

  /** Loads the catalog once per generation. */
  function load(): void {
    loading ??= context.catalog.list().then((stories) => {
      const next = new Map<string, string>()
      for (const story of stories) {
        next.set(getTargetKey({ storyId: story.id, variantId: null }), story.title)
        for (const variant of story.variants) next.set(getTargetKey({ storyId: story.id, variantId: variant.id }), `${story.title} › ${variant.title}`)
      }
      titles = next
      for (const listener of [...listeners]) listener()
    }, () => {
      // Catalog unavailable (not connected yet): retry on next use.
      loading = undefined
    })
  }
  context.subscribe(() => {
    loading = undefined
  })

  return {
    /**
     * Title of a target, or `undefined` until the catalog loaded.
     * @param target Story and variant.
     */
    get(target: HistoireTarget): string | undefined {
      load()
      return titles.get(getTargetKey(target))
    },
    /**
     * Observes title reloads.
     * @param listener Called after the catalog loaded.
     */
    subscribe(listener: () => void): Disposer {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Title lookup of one plugin instance. */
export type Titles = ReturnType<typeof createTitles>
