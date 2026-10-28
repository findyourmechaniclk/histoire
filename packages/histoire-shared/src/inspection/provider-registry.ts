import type { HistoireComponentElementInspection, HistoireComponentInspection, HistoireComponentTreeInspection } from '@histoire/protocol'

/** Metadata is attached only by the runtime after its authority checks. */
type Projection<T> = Omit<T, 'mode' | 'owner' | 'observedAt' | 'durationMs' | 'inspection'>

/** Framework adapter returns detached projections, never framework instances. */
export interface FrameworkInspectionProvider {
  /** Read an active bounded component tree. */
  components: (options?: { rootId?: string, maxNodes?: number, maxDepth?: number }) => Projection<HistoireComponentTreeInspection>
  /** Read one current component instance by opaque ID. */
  component: (componentId: string) => Projection<HistoireComponentInspection>
  /** Find an element's proven owner within the captured mount. */
  componentForElement: (selector: string) => Projection<HistoireComponentElementInspection>
  /** Resolve a live element only inside the owning runtime, never over the bridge. */
  resolveComponentElement?: (componentId: string) => Element
}

interface Entry {
  /** Factory lazily creates an inspection provider only when requested. */
  create: () => FrameworkInspectionProvider | undefined
  /** Retire the current provider without unregistering its live host. */
  invalidate: () => void
}

/** Shared across independently bundled runtime and framework plugin copies. */
const REGISTRY_KEY = '__HST_FRAMEWORK_INSPECTION_PROVIDERS__'
type InspectionGlobals = typeof globalThis & { [REGISTRY_KEY]?: WeakMap<Element, Set<Entry>> }

/** Find the shared weak registry without keeping retired roots alive. */
function registry() {
  const global = globalThis as InspectionGlobals
  return global[REGISTRY_KEY] ??= new WeakMap()
}

/** Register a render owner under its exact actor root; this grants no authority. */
export function registerFrameworkInspection(root: Element, create: () => FrameworkInspectionProvider | undefined, invalidate: () => void): () => void {
  const map = registry()
  const entries = map.get(root) ?? new Set<Entry>()
  const entry = { create, invalidate }
  entries.add(entry)
  map.set(root, entries)
  let active = true
  return () => {
    if (!active) return
    active = false
    entries.delete(entry)
    // A stale disposer must never erase a later registration on the same root.
    if (!entries.size && map.get(root) === entries) map.delete(root)
  }
}

/** Resolve only an unambiguous exact root after the caller's own authority checks. */
export function getFrameworkInspection(root: Element): FrameworkInspectionProvider | undefined {
  const entries = registry().get(root)
  return entries?.size === 1 ? entries.values().next().value?.create() : undefined
}

/** Retire provider IDs when an actor is replaced, even if its host persists. */
export function invalidateFrameworkInspection(root: Element): void {
  const map = registry()
  const entries = map.get(root)
  if (!entries) return
  for (const entry of [...entries]) {
    if (!entries.has(entry)) continue
    try {
      entry.invalidate()
    }
    catch {
      // A broken owner must not remain discoverable after failed retirement.
      entries.delete(entry)
    }
  }
  if (!entries.size && map.get(root) === entries) map.delete(root)
}
