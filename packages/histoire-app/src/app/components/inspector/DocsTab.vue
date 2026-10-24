<script setup lang="ts">
import { HistoireDocs } from '@histoire/vue'
import { useSelection } from '../../composables/selection.js'
import WorkbenchEmptyState from '../shell/WorkbenchEmptyState.vue'
import { useInspectorModel } from './model.js'

defineEmits<{ error: [error: unknown] }>()
const { story } = useSelection()
const { docsAnchor } = useInspectorModel()
</script>

<template>
  <HistoireDocs v-if="story?.content.docs" :anchor="docsAnchor" @error="$emit('error', $event)" />
  <WorkbenchEmptyState v-else icon="document-blank" title="No documentation" />
</template>
