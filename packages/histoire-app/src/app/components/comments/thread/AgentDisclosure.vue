<script setup lang="ts">
defineSlots<{
  /** Disclosure icon and accessible heading. */
  default?: () => any
}>()
</script>

<template>
  <button type="button" class="htw:flex htw:items-center htw:gap-1.5 htw:w-full htw:min-w-0 htw:py-0.75 htw:px-0 htw:border-0 htw:bg-transparent htw:text-inherit htw:[font:inherit] htw:text-left htw:cursor-pointer htw:disabled:cursor-default">
    <slot />
  </button>
</template>
