<script setup lang="ts">
import { BuiltinIcon, HstButton, HstPulsatingDisc } from '@histoire/controls/vue'
import { computed, ref, useId, watch } from 'vue'
import { useWorkbenchVisual } from '../../../stores/visual.js'
import { visualStatus } from './status.js'
import VisualViewerSurface from './VisualViewerSurface.vue'

defineProps<{
  /** Dialog's accessible title ID. */
  titleId: string
  /** Story or matrix case title. */
  title: string
  /** Selected result's position in filtered run. */
  index: number
  /** Failed captures show their message in the board instead. */
  captureFailed: boolean
}>()
const emit = defineEmits<{
  /** Page without changing canonical story selection. */
  move: [direction: number]
  /** Close review and restore its trigger. */
  close: []
}>()
const model = useWorkbenchVisual()!
const result = model.selectedResult
const warningsOpen = ref(false)
const warningId = useId()
const warnings = computed(() => [result.value?.error, result.value?.warning].filter(Boolean))
/** Same tone as results list rows; passed maps to accent dot color. */
const tone = computed(() => {
  const statusTone = result.value ? visualStatus(result.value).tone : 'muted'
  return statusTone === 'passed' ? 'accent' : statusTone
})
watch(result, () => {
  warningsOpen.value = false
})
</script>

<template>
  <header class="htw:relative htw:z-[3] htw:flex htw:items-start htw:flex-wrap htw:gap-2.5 htw:p-3.5 htw:@max-[640px]/viewer:p-2.5 htw:@max-[640px]/viewer:gap-2">
    <VisualViewerSurface class="htw:flex htw:items-center htw:flex-wrap htw:gap-2.5 htw:py-2 htw:pr-3 htw:pl-3.5 htw:min-w-0 htw:max-w-full htw:@max-[640px]/viewer:w-full">
      <span class="htw:flex-none htw:w-2 htw:h-2 htw:rounded-full htw:bg-muted htw:data-[tone=accent]:bg-accent htw:data-[tone=warn]:bg-warn htw:data-[tone=danger]:bg-danger" :data-tone="tone" aria-hidden="true" />
      <div class="htw:flex-1 htw:min-w-0">
        <h2 :id="titleId" class="htw:m-0 htw:text-[14px] htw:font-bold htw:wrap-anywhere">
          {{ title }}
        </h2>
        <small class="htw:block htw:text-[11px] htw:text-muted htw:wrap-anywhere">{{ result?.spec.id }} · {{ result?.baselineSource }}<code v-if="result?.baselineCommit" class="htw:ml-1"> {{ result.baselineCommit.slice(0, 8) }}</code></small>
        <small v-if="result" class="htw:flex htw:text-[11px] htw:text-muted htw:wrap-anywhere htw:items-center htw:flex-wrap htw:gap-[3px] htw:mt-0.5" role="status">
          <HstPulsatingDisc v-if="model.approvalPending(result)" :size="10" />
          <span>{{ model.approvalPending(result) ? 'Saving baseline' : visualStatus(result).label }}</span>
          <span v-if="result.staleReason"> · {{ result.staleReason }}</span>
          <span v-else-if="result.restored"> · Restored<span v-if="result.capturedAt"> · {{ new Date(result.capturedAt).toLocaleString() }}</span></span>
        </small>
      </div>
      <span v-if="result?.diffPixels !== undefined || result?.currentDimensions" class="htw:w-[1px] htw:h-6 htw:bg-border" aria-hidden="true" />
      <code v-if="result?.diffPixels !== undefined" class="htw:text-[11px] htw:whitespace-nowrap htw:data-[tone=warn]:text-warn htw:data-[tone=danger]:text-danger-text" :data-tone="tone" :title="`${result.diffPixels} pixels`">{{ ((result.diffPixelRatio ?? 0) * 100).toFixed(3) }}%</code>
      <code v-if="result?.currentDimensions" class="htw:text-[11px] htw:whitespace-nowrap htw:text-muted">{{ result.currentDimensions.width }} × {{ result.currentDimensions.height }}</code>
    </VisualViewerSurface>
    <div v-if="!captureFailed && warnings.length" class="htw:self-center htw:@max-[640px]/viewer:mr-auto">
      <VisualViewerSurface :as="HstButton" class="htw:text-warn htw:text-[12px] htw:whitespace-nowrap" :aria-expanded="warningsOpen" :aria-controls="warningId" @click="warningsOpen = !warningsOpen">
        <BuiltinIcon icon="warning-alt" :size="14" />
        {{ warnings.length }} {{ warnings.length === 1 ? 'warning' : 'warnings' }}
      </VisualViewerSurface>
      <VisualViewerSurface v-if="warningsOpen" :id="warningId" class="htw:absolute htw:top-[calc(100%_-_8px)] htw:left-3.5 htw:w-[min(480px,_calc(100%_-_28px))] htw:max-h-60 htw:overflow-auto htw:p-3 htw:text-[12px] htw:whitespace-pre-wrap htw:wrap-anywhere htw:@max-[640px]/viewer:left-2.5 htw:@max-[640px]/viewer:w-[calc(100%_-_20px)]" role="region" aria-label="Capture warnings">
        <p v-for="(warning, warningIndex) in warnings" :key="warningIndex" class="htw:m-0 htw:not-first:mt-2">
          {{ warning }}
        </p>
      </VisualViewerSurface>
    </div>
    <nav class="htw:flex htw:items-center htw:gap-2.5 htw:ml-auto" aria-label="Visual results">
      <VisualViewerSurface class="htw:flex htw:items-center htw:gap-0.5 htw:p-0.5">
        <HstButton color="flat" icon-only aria-label="Previous visual result" :disabled="index <= 0" @click="emit('move', -1)">
          <BuiltinIcon icon="chevron-left" :size="18" />
        </HstButton>
        <code class="htw:py-0 htw:px-1.5 htw:text-[12px] htw:text-muted htw:whitespace-nowrap"><span class="htw:text-text">{{ index + 1 }}</span> / {{ model.results.value.length }}</code>
        <HstButton color="flat" icon-only aria-label="Next visual result" :disabled="index >= model.results.value.length - 1" @click="emit('move', 1)">
          <BuiltinIcon icon="chevron-right" :size="18" />
        </HstButton>
      </VisualViewerSurface>
      <VisualViewerSurface :as="HstButton" class="htw:[--histoire-icon-button-size:38px]" icon-only aria-label="Close visual review" @click="emit('close')">
        <BuiltinIcon icon="close" :size="18" />
      </VisualViewerSurface>
    </nav>
  </header>
</template>
