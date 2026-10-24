<script setup lang="ts">
import type { WorkbenchContext } from '@histoire/plugin-kit'
import type { ReferenceModel } from '../domain/model.js'
import { WorkbenchEmptyState, WorkbenchPaneList } from '@histoire/plugin-kit/vue'
import { overviewRows } from '../domain/view-state.js'
import { useViewState } from './use-view-state.js'

const props = defineProps<{
  /** Root context. */
  context: WorkbenchContext
  /** Plugin state. */
  model: ReferenceModel
}>()
const rows = useViewState(props.model, () => overviewRows(props.model))
</script>

<template>
  <WorkbenchEmptyState v-if="!rows.length" icon="view" title="No audited frames" />
  <WorkbenchPaneList v-else>
    <!-- Rows pad their content by the row inset; the list insets them by the pane gutter. -->
    <ul class="hst-ref-list">
      <li v-for="row in rows" :key="row.key">
        <button type="button" class="hst-ref-item" @click="context.navigation.selectStory(row.target)">
          <span class="hst-ref-grow">{{ row.name }}</span>
          <span class="hst-ref-chip" :data-tone="row.warn ? 'warn' : undefined">{{ row.count }}</span>
        </button>
      </li>
    </ul>
  </WorkbenchPaneList>
</template>
