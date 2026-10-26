<script setup lang="ts">
defineSlots<{
  /** Meta content. */
  default?: () => any
}>()
</script>

<template>
  <span class="htw:ms-auto htw:text-muted htw:font-mono htw:text-[11px]"><slot /></span>
</template>
