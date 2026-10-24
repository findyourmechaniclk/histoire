// Per-user plugin preferences: stored by the host under a plugin and project namespace,
// never saved to project config. Framework-free.
import type { Disposer, PluginPreferences } from '@histoire/plugin-kit'

/** Annotation rectangle in canvas space; plain JSON. */
// eslint-disable-next-line ts/consistent-type-definitions -- JSON payload: an interface lacks the index signature `HistoireJsonValue` needs
export type Annotation = {
  /** Unique id. */
  id: string
  /** Left edge in canvas units. */
  x: number
  /** Top edge in canvas units. */
  y: number
  /** Width in canvas units. */
  width: number
  /** Height in canvas units. */
  height: number
}

/** Preference keys. */
const KEYS = { badges: 'badges', annotations: 'annotations' } as const

/**
 * Typed access to the reference plugin's preferences.
 * @param preferences `api.preferences`.
 */
export function createReferencePreferences(preferences: PluginPreferences) {
  return {
    /** Whether frames show their issue count badge. */
    badges: (): boolean => preferences.get(KEYS.badges, true),
    /**
     * Shows or hides frame issue badges.
     * @param value New state.
     */
    setBadges: (value: boolean) => preferences.set(KEYS.badges, value),
    /** Saved annotations. */
    annotations: (): readonly Annotation[] => preferences.get<Annotation[]>(KEYS.annotations, []),
    /**
     * Saves one more annotation.
     * @param annotation Rectangle in canvas space.
     */
    addAnnotation(annotation: Omit<Annotation, 'id'>): void {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      preferences.set(KEYS.annotations, [...this.annotations(), { id, ...annotation }])
    },
    /** Removes every annotation. */
    clearAnnotations: () => preferences.set(KEYS.annotations, []),
    /**
     * Observes any reference preference.
     * @param listener Called after a change.
     */
    subscribe(listener: () => void): Disposer {
      const stops = Object.values(KEYS).map(key => preferences.subscribe(key, listener))
      return () => stops.forEach(stop => stop())
    },
  }
}

/** Typed preferences of one plugin instance. */
export type ReferencePreferences = ReturnType<typeof createReferencePreferences>
