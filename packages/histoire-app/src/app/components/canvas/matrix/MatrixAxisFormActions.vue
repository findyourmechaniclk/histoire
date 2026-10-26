<script setup lang="ts">
defineSlots<{
  /** Axis editor confirmation and cancellation controls. */
  default?: () => any
}>()
</script>

<template>
  <div class="htw:flex htw:justify-end htw:items-center htw:gap-2">
    <slot />
  </div>
</template>
