import type { WorkbenchPluginEntry } from '../../../../../histoire-app/src/app/extensions/plugins.js'
import type { WorkbenchPluginDefinition } from '../../../../../histoire-plugin-kit/src/index.js'
import type { HistoireSnapshot, HistoireTarget } from '../../../../../histoire-protocol/src/index.js'
import { vi } from 'vitest'
import { createWorkbenchHost } from '../../../../../histoire-app/src/app/extensions/create-workbench-host.js'
import { createEmbedSnapshot } from './embed/catalog.js'

/** Session double publishing whole snapshots; covers the public methods extension contexts read. */
export function createSnapshotSession(selection: HistoireTarget | null = null, state: Record<string, unknown> | null = null) {
  let snapshot: HistoireSnapshot = createEmbedSnapshot()
  snapshot.selection = selection
  if (selection && state) snapshot.state = { target: selection, runtimeId: 'runtime', value: state }
  const listeners = new Set<(snapshot: HistoireSnapshot) => void>()
  /**
   * Replaces snapshot fields and notifies subscribers, as an SDK publication would.
   * @param patch Changed snapshot fields.
   */
  function publish(patch: Partial<HistoireSnapshot>): void {
    snapshot = { ...snapshot, ...patch }
    for (const listener of [...listeners]) listener(snapshot)
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: (snapshot: HistoireSnapshot) => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    catalog: {
      list: async () => snapshot.catalog.stories,
      getStory: async (storyId: string) => snapshot.catalog.stories.find(story => story.id === storyId)!,
      search: async () => [],
    },
    publish,
    /** Moves the selection like a route or canvas click would. */
    select: (target: HistoireTarget | null) => publish({ selection: target }),
    /** Starts a new source generation (dev server restart, rebuilt book). */
    restartSource: () => publish({ source: { ...snapshot.source!, epoch: `${snapshot.source!.epoch}+` } }),
    /** Active subscriptions, to prove scopes release theirs. */
    get listenerCount() {
      return listeners.size
    },
  }
}

/** Session double type. */
export type SnapshotSession = ReturnType<typeof createSnapshotSession>

/**
 * Wraps a plugin definition in a manifest entry, as `virtual:$histoire-workbench-plugins` generates.
 * @param definition Module default export.
 * @param load Optional loader override (pending or failing imports).
 */
export function pluginEntry(definition: WorkbenchPluginDefinition, load?: WorkbenchPluginEntry['load']): WorkbenchPluginEntry {
  return { id: definition.id, apiVersion: 1, options: undefined, load: load ?? (async () => ({ default: definition })) }
}

/**
 * Creates a standalone-shaped workbench host with recording navigation targets.
 * @param overrides Options merged over the defaults (dev mode, no plugins).
 */
export function createTestWorkbenchHost(overrides: Partial<Parameters<typeof createWorkbenchHost>[0]> = {}) {
  const session = (overrides.session as SnapshotSession | undefined) ?? createSnapshotSession({ storyId: 'a:b', variantId: 'c' })
  const targets = {
    selectStory: vi.fn(async () => {}),
    inspectorTab: vi.fn(),
    pane: vi.fn(),
    settings: vi.fn(),
    canvasView: vi.fn(),
  }
  const warn = vi.fn()
  const error = vi.fn()
  const workbench = createWorkbenchHost({ mode: 'dev', plugins: [], navigation: targets, warn, error, ...overrides, session })
  return { workbench, session, targets, warn, error }
}
