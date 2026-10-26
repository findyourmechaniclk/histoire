<script setup lang="ts">
import { HistoireControls, useHistoireSnapshot } from '@histoire/vue'
import WorkbenchEmptyState from '../shell/WorkbenchEmptyState.vue'
import WorkbenchLoadingSkeleton from '../shell/WorkbenchLoadingSkeleton.vue'

defineEmits<{ error: [error: unknown] }>()
const snapshot = useHistoireSnapshot()
</script>

<template>
  <section class="htw:min-w-0" data-test-id="story-controls" aria-label="Props">
    <slot name="matrix">
      <HistoireControls
        compact-presets :classes="{
          root: 'htw:pt-0 htw:px-[calc(var(--histoire-inspector-gutter)-var(--histoire-control-wrapper-padding,8px))] htw:pb-[16px]',
          presets: 'htw:mt-[2px] htw:mx-control-wrapper-padding htw:mb-[20px]',
          presetTrigger: 'htw:w-control htw:h-control htw:p-0',
          reset: 'htw:self-start htw:mt-[2px] htw:mx-control-wrapper-padding htw:mb-0 htw:h-control',
          fieldset: 'htw:p-0 htw:mt-0 htw:mx-0 htw:mb-[14px] htw:border-0',
          legend: 'htw:p-0 htw:mx-control-wrapper-padding htw:mb-[10px] htw:text-muted htw:text-[13px]',
        }" @error="$emit('error', $event)"
      >
        <template #loading>
          <WorkbenchLoadingSkeleton label="Loading controls" :rows="4" />
        </template>
        <template #unavailable>
          <WorkbenchLoadingSkeleton v-if="snapshot.status === 'ready' && snapshot.selection?.variantId && !snapshot.stale && snapshot.runtime.status !== 'failed'" label="Loading controls" :rows="4" />
          <WorkbenchEmptyState v-else flush class="htw:my-12 htw:mx-control-wrapper-padding" icon="cursor-1" title="Select a variant" />
        </template>
      </HistoireControls>
    </slot>
  </section>
</template>
