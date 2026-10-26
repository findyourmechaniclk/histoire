<script setup lang="ts">
defineSlots<{
  /** Error content. */
  default?: () => any
}>()
</script>

<template>
  <p class="htw:my-[5px] htw:mx-2 htw:text-danger htw:text-[11px]">
    <slot />
  </p>
</template>
