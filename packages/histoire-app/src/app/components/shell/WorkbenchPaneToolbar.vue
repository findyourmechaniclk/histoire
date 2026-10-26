<script setup lang="ts">
defineProps<{
  /** Spacing relative to preceding content. Omission preserves legacy sibling inference. */
  position?: 'start' | 'header' | 'content'
}>()

defineSlots<{
  /** Filters or section switches; a button group fills the row. */
  default: () => any
}>()
</script>

<template>
  <div class="workbench-pane-toolbar htw:flex htw:flex-none htw:gap-2 htw:px-pane-gutter htw:pb-pane-gutter" :class="position === 'header' ? 'htw:pt-0' : position ? 'htw:pt-pane-gutter' : 'htw:pt-pane-gutter htw:[.workbench-pane-header+&]:pt-0 htw:[.workbench-pane-toolbar+&]:pt-0'">
    <slot />
  </div>
</template>
