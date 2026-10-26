<script setup lang="ts">
defineSlots<{
  /** Optional separator content. */
  default?: () => any
}>()
</script>

<template>
  <div class="htw:h-px htw:my-[5px] htw:mx-0 htw:bg-border">
    <slot />
  </div>
</template>
