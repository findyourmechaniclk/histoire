<script setup lang="ts">
defineSlots<{
  /** Rows padded by `--histoire-pane-row-inset`, so their content lines up with the pane gutter. */
  default: () => any
}>()
</script>

<template>
  <div class="htw:flex-1 htw:min-h-0 htw:overflow-auto htw:pt-0 htw:px-pane-gutter htw:pb-pane-gutter">
    <slot />
  </div>
</template>
