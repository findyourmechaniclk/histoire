<script setup lang="ts">
import type { HistoireTarget } from '@histoire/protocol'
import { HstButtonGroup } from '@histoire/controls/vue'
import { useWorkbenchVisual } from '../../../stores/visual.js'
import VisualTestsPanel from '../visual/VisualTestsPanel.vue'
import FunctionalTestsPanel from './FunctionalTestsPanel.vue'

const emit = defineEmits<{ select: [target: HistoireTarget], error: [error: unknown] }>()
const visual = useWorkbenchVisual()
</script>

<template>
  <div class="htw:flex htw:flex-col htw:h-full htw:min-h-0">
    <HstButtonGroup v-if="visual" v-model="visual.mode.value" class="htw:flex htw:mt-3 htw:mx-pane-gutter htw:mb-0" layout="inline" aria-label="Test type" :options="[{ value: 'functional', label: 'Functional' }, { value: 'visual', label: 'Visual' }]" />
    <VisualTestsPanel v-if="visual?.mode.value === 'visual'" class="htw:flex-1 htw:min-h-0" />
    <FunctionalTestsPanel v-else class="htw:flex-1 htw:min-h-0" @select="emit('select', $event)" @error="emit('error', $event)" />
  </div>
</template>
