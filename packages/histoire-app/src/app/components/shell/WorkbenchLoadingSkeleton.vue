<script setup lang="ts">
withDefaults(defineProps<{
  /** Accessible status; decorative shapes never expose invented field names. */
  label?: string
  /** Number of label-and-field placeholders matching expected content density. */
  rows?: number
}>(), { label: 'Loading', rows: 3 })
</script>

<template>
  <div class="workbench-loading-skeleton htw:grid htw:gap-6 htw:pt-0.5 htw:px-control-wrapper-padding htw:pb-4" role="status" :aria-label="label" aria-busy="true">
    <div v-for="row in rows" :key="row" class="htw:grid htw:gap-3" aria-hidden="true">
      <div class="htw:w-[30%] htw:h-3 htw:rounded-[4px] htw:bg-chip htw:animate-skeleton-pulse htw:motion-reduce:animate-none" />
      <div class="htw:w-full htw:h-control htw:rounded-[7px] htw:bg-chip htw:animate-skeleton-pulse htw:motion-reduce:animate-none" />
    </div>
  </div>
</template>
