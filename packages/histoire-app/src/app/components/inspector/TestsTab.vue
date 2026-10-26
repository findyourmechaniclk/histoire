<script setup lang="ts">
import { HistoireTests } from '@histoire/vue'
import WorkbenchEmptyState from '../shell/WorkbenchEmptyState.vue'
import WorkbenchErrorState from '../shell/WorkbenchErrorState.vue'
import WorkbenchLoadingState from '../shell/WorkbenchLoadingState.vue'
import { useInspectorModel } from './model.js'

defineEmits<{ error: [error: unknown] }>()
const { entry, cachedFailure, cachedCollection, cachedSummary } = useInspectorModel().tests
</script>

<template>
  <WorkbenchErrorState v-if="cachedFailure" title="Tests unavailable">
    {{ cachedFailure }}
  </WorkbenchErrorState>
  <HistoireTests v-if="!cachedFailure || cachedCollection" :classes="{ root: 'htw:pt-[2px] htw:px-inspector-gutter htw:pb-[16px] htw:text-[12px]' }" :summary="cachedSummary" :collection="cachedCollection" :running="entry?.running" @error="$emit('error', $event)">
    <template #empty="{ collected }">
      <WorkbenchEmptyState class="htw:flex-1" icon="chemistry" :title="collected ? 'No tests' : 'Tests not collected'" />
    </template>
    <template #loading="{ collecting }">
      <WorkbenchLoadingState class="htw:flex-1" :title="collecting ? 'Collecting tests…' : 'Running tests…'" />
    </template>
  </HistoireTests>
</template>
