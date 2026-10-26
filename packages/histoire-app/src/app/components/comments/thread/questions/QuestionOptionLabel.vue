<script setup lang="ts">
defineSlots<{
  /** Option name and optional descriptive content. */
  default?: () => any
}>()
</script>

<template>
  <span class="htw:flex htw:flex-wrap htw:items-center htw:gap-1.5 htw:font-medium htw:leading-[1.4] htw:wrap-anywhere">
    <slot />
  </span>
</template>
