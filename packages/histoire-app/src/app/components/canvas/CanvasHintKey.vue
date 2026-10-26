<script setup lang="ts">
defineSlots<{
  /** Keyboard key displayed within a canvas hint. */
  default?: () => any
}>()
</script>

<template>
  <kbd class="htw:inline-block htw:px-1 htw:border htw:border-solid htw:border-border htw:rounded-[4px] htw:font-mono htw:text-[11px] htw:leading-[14px]"><slot /></kbd>
</template>
