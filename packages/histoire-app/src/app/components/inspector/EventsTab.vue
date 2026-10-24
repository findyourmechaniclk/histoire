<script setup lang="ts">
import { HistoireEvents } from '@histoire/vue'
import WorkbenchEmptyState from '../shell/WorkbenchEmptyState.vue'
import { useInspectorModel } from './model.js'

defineEmits<{ error: [error: unknown] }>()
const { events } = useInspectorModel()
</script>

<template>
  <HistoireEvents v-if="events.length" inline-details />
  <WorkbenchEmptyState v-else icon="flash" title="No events yet" />
</template>
