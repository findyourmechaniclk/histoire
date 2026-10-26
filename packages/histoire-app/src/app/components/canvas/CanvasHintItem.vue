<script setup lang="ts">
defineProps<{
  /** Highlight the active tool name within the hint row. */
  title?: boolean
  /** Hide secondary instructions when usable canvas width is limited. */
  secondary?: boolean
}>()
defineSlots<{
  /** Tool name or keyboard instruction. */
  default?: () => any
}>()
</script>

<template>
  <span class="htw:inline-flex htw:items-center htw:gap-1 htw:box-border htw:h-6 htw:px-[7px] htw:border htw:border-solid htw:border-transparent htw:rounded-[6px] htw:leading-4" :class="[title ? 'htw:bg-chip htw:text-text' : '', secondary ? 'htw:[@container_canvas-status_(max-width:650px)]:hidden' : '']"><slot /></span>
</template>
