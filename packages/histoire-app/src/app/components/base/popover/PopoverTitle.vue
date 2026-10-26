<script setup lang="ts">
defineProps<{
  /** Use the smaller bottom gap above setup controls. */
  compact?: boolean
}>()
defineSlots<{
  /** Title content. */
  default?: () => any
}>()
</script>

<template>
  <p class="htw:mt-2 htw:mx-2 htw:text-muted htw:text-[11px] htw:font-bold" :class="compact ? 'htw:mb-1.5' : 'htw:mb-2.5'">
    <slot />
  </p>
</template>
