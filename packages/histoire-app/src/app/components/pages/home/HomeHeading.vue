<script setup lang="ts">
defineSlots<{
  /** Home section icon and heading text. */
  default?: () => any
}>()
</script>

<template>
  <h2 class="htw:flex htw:items-center htw:gap-[8px] htw:m-[0_0_14px] htw:text-[15px] htw:font-extrabold">
    <slot />
  </h2>
</template>
