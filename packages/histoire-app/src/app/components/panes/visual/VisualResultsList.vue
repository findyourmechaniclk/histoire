<script setup lang="ts">
import type { UiVisualResult } from '@histoire/shared'
import type { VisualFilter } from './projection.js'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { useHistoireSnapshot } from '@histoire/vue'
import { computed, ref } from 'vue'
import { useWorkbenchVisual } from '../../../stores/visual.js'
import WorkbenchVirtualList from '../../lists/WorkbenchVirtualList.vue'
import { projectVisualRows } from './projection.js'
import VisualResultRow from './VisualResultRow.vue'

/** Story-grouped virtual results; `canApprove` decides which rows get a checkbox. */
const props = defineProps<{ filter: VisualFilter, canApprove: (result: UiVisualResult) => boolean }>()
const model = useWorkbenchVisual()!
const snapshot = useHistoireSnapshot()
const closed = ref(new Set<string>())
const titles = computed(() => new Map(snapshot.value.catalog.stories.map(story => [story.id, story.title])))
const entries = computed(() => projectVisualRows(model.results.value, id => titles.value.get(id) ?? id, props.filter, closed.value))
/** Reserve checkbox column only when at least one visible row can be approved, keeping rows aligned. */
const selectable = computed(() => entries.value.some(entry => entry.kind === 'result' && props.canApprove(entry.result)))

/** Disclosure changes only local list presentation. */
function toggle(storyId: string): void {
  const next = new Set(closed.value)
  if (!next.delete(storyId)) next.add(storyId)
  closed.value = next
}
</script>

<template>
  <div class="htw:flex-1 htw:min-h-0 htw:overflow-hidden htw:pt-0 htw:px-pane-gutter htw:pb-2">
    <WorkbenchVirtualList :items="entries" :item-size="40" list-tag="ul" item-tag="li">
      <template #default="{ item }">
        <HstButton v-if="item.kind === 'heading'" color="flat" type="button" class="htw:flex htw:items-center htw:gap-2 htw:w-full htw:h-[var(--histoire-virtual-row-height,_39px)] htw:py-2.5 htw:px-pane-row-inset htw:text-text htw:leading-4.5 htw:text-left htw:hover:bg-chip htw:focus-visible:[outline:2px_solid_var(--histoire-accent)] htw:focus-visible:outline-offset-[-2px]" :aria-expanded="!closed.has(item.storyId)" @click="toggle(item.storyId)">
          <BuiltinIcon class="htw:flex-none htw:text-muted" :icon="closed.has(item.storyId) ? 'chevron-right' : 'chevron-down'" :size="16" />
          <strong class="htw:flex-1 htw:min-w-0 htw:overflow-hidden htw:whitespace-nowrap htw:text-ellipsis htw:font-[750]">{{ item.title }}</strong>
          <span class="htw:text-[11px] htw:font-mono htw:text-muted" :title="`${item.passed} of ${item.total} passed`">{{ item.passed }} / {{ item.total }}</span>
        </HstButton>
        <VisualResultRow v-else-if="item.kind === 'result'" :result="item.result" :label="item.label" :approvable="canApprove(item.result)" :selectable="selectable" />
      </template>
    </WorkbenchVirtualList>
  </div>
</template>
