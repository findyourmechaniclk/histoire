<script setup lang="ts">
defineProps<{
  /** Locked measurement adds a breadcrumb row above its actions. */
  stacked?: boolean
}>()
defineSlots<{
  /** Tool or measurement status content. */
  default?: () => any
}>()
</script>

<template>
  <div class="histoire-canvas-hint htw:flex htw:flex-[0_1_auto] htw:justify-center htw:gap-0.5 htw:w-max htw:max-w-full htw:mx-auto htw:p-1.5 htw:border htw:border-solid htw:border-border htw:rounded-[10px] htw:bg-surface htw:shadow-canvas-toolbar htw:text-muted htw:text-[12px] htw:whitespace-nowrap" :class="stacked ? 'htw:flex-col htw:flex-nowrap htw:items-stretch htw:pointer-events-auto' : 'htw:flex-wrap htw:items-center'">
    <slot />
  </div>
</template>
