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
  <HistoireDocs v-if="story?.content.docs" :classes="{ root: 'htw:pt-[2px] htw:px-inspector-gutter htw:pb-[16px] htw:text-body htw:text-[12px] htw:leading-[1.7] htw:[&_:is(h1,h2,h3,h4)]:text-text htw:[&_:is(h1,h2,h3,h4)]:font-extrabold htw:[&_table]:w-full htw:[&_table]:text-[11px] htw:[&_table]:border-collapse htw:[&_:is(th,td)]:p-[9px] htw:[&_:is(th,td)]:text-left htw:[&_:is(th,td)]:border-b htw:[&_:is(th,td)]:border-border' }" :anchor="docsAnchor" @error="$emit('error', $event)" />
  <WorkbenchEmptyState v-else icon="document-blank" title="No documentation" />
</template>
