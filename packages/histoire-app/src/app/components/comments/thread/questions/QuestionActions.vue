<script setup lang="ts">
defineSlots<{
  /** Question submission and dismissal controls. */
  default?: () => any
}>()
</script>

<template>
  <div class="htw:flex htw:flex-wrap htw:justify-end htw:gap-1.5">
    <slot />
  </div>
</template>
