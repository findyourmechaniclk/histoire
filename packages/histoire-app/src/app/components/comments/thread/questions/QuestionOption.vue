<script setup lang="ts">
defineSlots<{
  /** Native input and associated option label. */
  default?: () => any
}>()
</script>

<template>
  <!-- Tint reaches the card inset; input and legend remain aligned. -->
  <label class="htw:flex htw:items-start htw:gap-1.5 htw:my-0 htw:-mx-2.25 htw:py-1.25 htw:px-2.25 htw:rounded-[7px] htw:cursor-pointer htw:hover:bg-chip">
    <slot />
  </label>
</template>
