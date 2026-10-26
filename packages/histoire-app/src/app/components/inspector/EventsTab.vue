<script setup lang="ts">
import { HistoireEvents } from '@histoire/vue'
import WorkbenchEmptyState from '../shell/WorkbenchEmptyState.vue'
import { useInspectorModel } from './model.js'

defineEmits<{ error: [error: unknown] }>()
const { events } = useInspectorModel()
</script>

<template>
  <HistoireEvents
    v-if="events.length" :classes="{
      root: 'htw:[--histoire-virtual-item-gap:8px] htw:relative htw:pt-[2px] htw:px-inspector-gutter htw:pb-[16px]',
      count: 'htw:absolute htw:top-[9px] htw:start-inspector-gutter htw:text-muted htw:text-[10px]',
      loadMore: 'htw:block htw:ml-auto htw:border-0 htw:rounded-[7px] htw:bg-chip htw:py-[7px] htw:px-[10px] htw:text-[11px] htw:font-bold htw:cursor-pointer',
      list: 'htw:my-2 htw:mx-0 htw:p-0 htw:list-none',
      row: 'htw:p-[10px] htw:rounded-[8px] htw:bg-chip htw:[font:11px_var(--histoire-font-mono)]',
      heading: 'htw:flex htw:gap-[8px] htw:w-full htw:text-left',
      time: 'htw:ml-auto htw:text-muted htw:text-[10px]',
      argument: 'htw:mt-[8px] htw:mx-0 htw:mb-0 htw:max-h-[120px] htw:overflow-auto htw:whitespace-pre-wrap htw:[overflow-wrap:anywhere] htw:text-muted htw:font-mono htw:text-[10px] htw:leading-[1.6]',
    }" inline-details
  />
  <WorkbenchEmptyState v-else icon="flash" title="No events yet" />
</template>
