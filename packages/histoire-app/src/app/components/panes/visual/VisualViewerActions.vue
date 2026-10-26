<script setup lang="ts">
import { BuiltinIcon, HstButton, HstPulsatingDisc } from '@histoire/controls/vue'
import { computed } from 'vue'
import { useWorkbenchVisual } from '../../../stores/visual.js'
import VisualViewerSurface from './VisualViewerSurface.vue'

defineProps<{
  /** Capture failure owns its Run again action in the board. */
  captureFailed: boolean
}>()
const emit = defineEmits<{
  /** Approve after moving focus to dialog. */
  approve: []
  /** Rerun after moving focus to dialog. */
  rerun: []
}>()
const model = useWorkbenchVisual()!
const result = model.selectedResult
const pending = computed(() => !!result.value && model.approvalPending(result.value))
/** Preserve review eligibility; keep pending action visible until receipt settles. */
const approvable = computed(() => !!result.value && !result.value.staleReason && !!result.value.reviewHandle && !model.busy(result.value) && !result.value.approved && !!result.value.currentHash && ['changed', 'missing', 'incompatible'].includes(result.value.status))
</script>

<template>
  <div class="htw:relative htw:flex htw:flex-col htw:items-end htw:gap-2 htw:min-w-0 htw:[grid-column:3] htw:justify-self-end htw:@max-[640px]/viewer:items-center htw:@max-[640px]/viewer:ml-0 htw:@max-[1200px]/viewer:@min-[640px]/viewer:ml-auto">
    <VisualViewerSurface v-if="model.issue.value" as="p" class="htw:[--viewer-float-background:var(--histoire-danger-soft)] htw:w-max htw:max-w-[min(400px,_100%)] htw:max-h-25 htw:overflow-auto htw:m-0 htw:py-2 htw:px-3 htw:text-danger-text htw:text-[12px] htw:whitespace-pre-line htw:wrap-anywhere" role="alert">
      {{ model.issue.value }}
    </VisualViewerSurface>
    <div class="htw:flex htw:flex-wrap htw:justify-end htw:gap-2 htw:@max-[640px]/viewer:justify-center">
      <VisualViewerSurface v-if="!captureFailed" :as="HstButton" class="htw:min-h-9 htw:rounded-[12px] htw:py-[7px] htw:px-3 htw:text-[12px] htw:font-semibold htw:whitespace-nowrap" :disabled="!!model.requestId.value || pending" @click="emit('rerun')">
        <BuiltinIcon icon="renew" :size="14" />Run again
      </VisualViewerSurface>
      <HstButton v-if="approvable" class="htw:min-h-9 htw:rounded-[10px] htw:py-[7px] htw:px-3 htw:text-[12px] htw:font-semibold htw:whitespace-nowrap" color="primary" :disabled="model.approving.value" @click="emit('approve')">
        <HstPulsatingDisc v-if="pending" :size="12" />
        <BuiltinIcon v-else icon="checkmark" :size="14" />
        {{ pending ? 'Saving baseline' : result?.status === 'missing' ? 'Create baseline' : 'Approve baseline' }}
      </HstButton>
    </div>
  </div>
</template>
