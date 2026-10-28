<script setup lang="ts">
import { computed } from 'vue'
import { useSelection } from '../../composables/selection.js'
import WorkbenchGuideLink from '../shell/WorkbenchGuideLink.vue'

const props = defineProps<{
  /** Inspector topic with an available guide. */
  guide: 'docs' | 'events' | 'tests'
}>()
const { story } = useSelection()
const href = computed(() => {
  if (props.guide === 'tests') return 'https://histoire.dev/guide/testing.html'
  const framework = story.value?.supportPluginId?.startsWith('svelte') ? 'svelte3' : 'vue3'
  return `https://histoire.dev/guide/${framework}/${props.guide}.html`
})
const label = computed(() => ({ docs: 'Add documentation', events: 'Log events', tests: 'Add tests' })[props.guide])
</script>

<template>
  <WorkbenchGuideLink :href="href" :label="label" />
</template>
