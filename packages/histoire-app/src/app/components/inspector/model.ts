import type { HistoireEvent } from '@histoire/protocol'
import type { HistoireSession } from '@histoire/sdk'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { useSelection } from '../../composables/selection.js'
import { getHistoireTargetKey } from '@histoire/protocol'
import { useProvidedHistoireTestsModel } from '@histoire/vue/internal'
import { computed, inject, provide } from 'vue'
import { useWorkbenchTestsModel } from '../panes/tests/model.js'

/** Run state shown on the Tests tab badge; absence of results never implies a pass. */
export type InspectorTestStatus = 'idle' | 'running' | 'passed' | 'failed'

/**
 * Test state of the selected target: the project-wide cache for the exact target and current
 * source, falling back to the selected frame's own tests model.
 * @param session Provider session of this inspector.
 * @param snapshot Provider snapshot.
 * @param projectTestSession Root workbench session holding project-wide test aggregation.
 */
export function useInspectorTestsState(session: HistoireSession, snapshot: ReturnType<typeof useSelection>['snapshot'], projectTestSession?: HistoireSession) {
  const tests = useProvidedHistoireTestsModel(session)
  const projectTests = useWorkbenchTestsModel(projectTestSession ?? session)
  /** Project results are displayed only for exact selected target and current source. */
  const entry = computed(() => {
    const target = snapshot.value.selection
    if (!target || snapshot.value.stale || snapshot.value.status !== 'ready') return undefined
    const value = projectTests?.entries.value.get(getHistoireTargetKey(target))
    return value?.stale && !value.running ? undefined : value
  })
  const cachedSummary = computed(() => entry.value?.running || entry.value?.stale || entry.value?.error ? undefined : entry.value?.summary ?? undefined)
  const cachedCollection = computed(() => entry.value?.stale ? undefined : entry.value?.collection ?? undefined)
  const cachedFailure = computed(() => {
    const error = entry.value?.error
    return error ? (error as Error).message ?? String(error) : undefined
  })
  const count = computed(() => cachedSummary.value?.total ?? cachedCollection.value?.definitions.length ?? tests?.state.value.collection?.definitions.length ?? 0)
  const status = computed((): InspectorTestStatus => {
    const value = tests?.state.value
    if (value?.status === 'running' || value?.status === 'collecting' || entry.value?.running) return 'running'
    const summary = cachedSummary.value ?? value?.summary
    if (summary) return summary.ok ? 'passed' : 'failed'
    if (value?.status === 'failed' || entry.value?.error) return 'failed'
    return 'idle'
  })
  return { entry, cachedSummary, cachedCollection, cachedFailure, count, status }
}

/** Per-inspector state the built-in tab bodies and badges read. */
export interface InspectorModel {
  /** Current documentation anchor supplied by the standalone adapter. */
  docsAnchor: ComputedRef<string | undefined>
  /** Events of the selected runtime and target. */
  events: ComputedRef<HistoireEvent[]>
  /** Unseen events of the selected document. */
  unseen: Ref<number>
  /** Test state of the selected target. */
  tests: ReturnType<typeof useInspectorTestsState>
}

/** One model per mounted inspector; two inspectors never share it. */
const inspectorModelKey: InjectionKey<InspectorModel> = Symbol('histoire-inspector-model')

/**
 * Provides the inspector model to its built-in tab bodies and badges.
 * @param model State owned by the calling inspector.
 */
export function provideInspectorModel(model: InspectorModel): void {
  provide(inspectorModelKey, model)
}

/**
 * Model of the nearest inspector.
 * @throws {Error} Outside a `StoryInspector`.
 */
export function useInspectorModel(): InspectorModel {
  const model = inject(inspectorModelKey, null)
  if (!model) throw new Error('Histoire inspector model is required')
  return model
}
