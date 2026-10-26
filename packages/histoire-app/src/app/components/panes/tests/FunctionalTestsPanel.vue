<script setup lang="ts">
import type { HistoireTarget } from '@histoire/protocol'
import type { WorkbenchTestRow } from './types.js'
import { BuiltinIcon, HstButton, HstPulsatingDisc, HstSwitch } from '@histoire/controls/vue'
import { getHistoireTargetKey } from '@histoire/protocol'
import { useHistoireSnapshot } from '@histoire/vue'
import { useHistoireContext, useHistoireResource } from '@histoire/vue/internal'
import { computed, ref, useId } from 'vue'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'
import WorkbenchErrorState from '../../shell/WorkbenchErrorState.vue'
import WorkbenchLoadingState from '../../shell/WorkbenchLoadingState.vue'
import WorkbenchPaneHeader from '../../shell/WorkbenchPaneHeader.vue'
import WorkbenchPanelAction from '../../shell/WorkbenchPanelAction.vue'

import { useWorkbenchTestsModel } from './model.js'
import { getCollectionFailure } from './projection.js'
import TestsFilter from './TestsFilter.vue'
import TestsSummary from './TestsSummary.vue'
import TestsTree from './TestsTree.vue'

const emit = defineEmits<{ select: [target: HistoireTarget], error: [error: unknown] }>()
const { session } = useHistoireContext()
const snapshot = useHistoireSnapshot()
const model = useWorkbenchTestsModel()
const filter = ref<'failing' | 'all' | 'changed'>('failing')
const watchModeId = `histoire-watch-tests-${useId()}`
let active = true
useHistoireResource(() => {
  active = false
})
const issue = computed(() => {
  const error = model?.error.value ?? model?.discoveryError.value
  return error ? (error instanceof Error ? error.message : String(error)).split('\n')[0] : null
})
/** Keep partial collection rows usable; replace only failed empty collection. */
const collectionFailure = computed(() => {
  if (!model) return null
  if (model.discoveryStatus.value === 'error' && !model.visibleRows.value.length) return issue.value ?? ''
  return model.discoveryStatus.value === 'collecting' ? null : getCollectionFailure(model.visibleRows.value)
})
const collectionFailed = computed(() => collectionFailure.value !== null)
/** Selection is canonical; root translates successful activation into inspector Tests tab. */
async function select(row: WorkbenchTestRow) {
  if (!row.selectable) return
  const source = session.getSnapshot().source
  try {
    await session.selection.select(row.target)
    const current = session.getSnapshot()
    if (active && !current.stale && current.selection && getHistoireTargetKey(current.selection) === getHistoireTargetKey(row.target) && current.source?.sourceId === source?.sourceId && current.source?.epoch === source?.epoch && current.source?.revision === source?.revision) emit('select', row.target)
  }
  catch (error) { if (active) emit('error', error) }
}
</script>

<template>
  <section class="tests-panel htw:flex htw:flex-col htw:h-full htw:min-h-0 htw:bg-surface htw:text-text" aria-label="Tests">
    <WorkbenchPaneHeader title="Tests">
      <HstButton color="flat" type="button" class="htw:inline-flex htw:items-center htw:justify-center htw:p-2" aria-label="Refresh tests" title="Refresh tests" :disabled="!model?.canRefresh.value" @click="model?.retryCollection()">
        <BuiltinIcon icon="renew" :size="16" />
      </HstButton>
      <WorkbenchPanelAction v-if="model?.running.value" icon="stop-filled-alt" label="Stop" @click="model.cancel()" />
      <WorkbenchPanelAction v-else icon="play-filled-alt" label="Run all" :disabled="!model?.canRun.value" @click="model?.runAll()" />
    </WorkbenchPaneHeader>
    <template v-if="model">
      <TestsSummary :summary="model.summary.value" :running="model.running.value" :completed="model.completed.value" :total="model.total.value" />
      <TestsFilter v-model="filter" />
      <div v-if="['collecting', 'error'].includes(model.discoveryStatus.value) && model.discoveryProgress.value.completed" class="collection-progress htw:flex htw:items-center htw:gap-2 htw:my-2.5 htw:mx-pane-gutter htw:text-muted htw:text-[12px]" role="status">
        <HstPulsatingDisc v-if="model.discoveryStatus.value === 'collecting'" :size="12" />
        {{ model.discoveryStatus.value === 'collecting' ? 'Collecting tests…' : 'Collected targets' }} {{ model.discoveryProgress.value.completed }}/{{ model.discoveryProgress.value.total }}
      </div>
      <p v-if="issue && !collectionFailed" class="htw:my-2.5 htw:mx-pane-gutter htw:text-danger-text htw:text-[12px] htw:wrap-anywhere htw:whitespace-pre-line" role="alert">
        {{ issue }}
      </p>
      <HstButton v-if="model.discoveryStatus.value === 'error' && !collectionFailed" color="flat" type="button" class="htw:my-2.5 htw:mx-pane-gutter htw:self-start" @click="model.retryCollection()">
        Retry collection
      </HstButton>
      <WorkbenchErrorState v-if="collectionFailed" title="Test collection failed">
        {{ collectionFailure }}
        <template #actions>
          <HstButton color="flat" tone="danger" type="button" @click="model.retryCollection()">
            Retry collection
          </HstButton>
        </template>
      </WorkbenchErrorState>
      <WorkbenchLoadingState v-else-if="model.discoveryStatus.value === 'collecting' && !model.discoveryProgress.value.completed && !model.visibleRows.value.length" title="Collecting tests…" />
      <TestsTree v-else-if="model.discoveryStatus.value !== 'error' || model.visibleRows.value.length" :rows="model.visibleRows.value" :filter="filter" :selected="snapshot.selection" @select="select" />
      <footer class="htw:mt-auto htw:border-t htw:border-solid htw:border-border">
        <label :for="watchModeId" class="htw:flex htw:items-center htw:gap-[9px] htw:box-border htw:[inline-size:100%] htw:[min-inline-size:0] htw:py-3.5 htw:px-pane-gutter htw:cursor-pointer htw:hover:bg-chip htw:data-[disabled]:[cursor:default] htw:data-[disabled]:hover:bg-transparent" :data-disabled="!model.canRun.value || undefined">
          <BuiltinIcon class="htw:flex-none htw:text-muted" icon="view" :size="16" />
          <span class="htw:flex-1 htw:[min-inline-size:0] htw:text-[12px] htw:font-bold">Watch mode</span>
          <HstSwitch :id="watchModeId" class="htw:flex-none" layout="inline" aria-label="Watch tests" :model-value="model.watchTests.value" :disabled="!model.canRun.value" @update:model-value="model.setWatch($event)" />
        </label>
      </footer>
    </template>
    <WorkbenchEmptyState v-else icon="test-tool" title="Server tests unavailable" />
  </section>
</template>
