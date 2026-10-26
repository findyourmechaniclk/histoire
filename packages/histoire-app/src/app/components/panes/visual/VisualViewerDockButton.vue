<script setup lang="ts">
import { HstButton } from '@histoire/controls/vue'

defineSlots<{
  /** Dock action icon or label. */
  default?: () => any
}>()
</script>

<template>
  <!-- Icon controls keep their package sizing hook; all dock actions share padding. -->
  <HstButton class="htw:min-h-7.5 htw:py-1 htw:px-[9px] htw:text-[12px] htw:whitespace-nowrap htw:[--histoire-icon-button-size:30px]">
    <slot />
  </HstButton>
</template>
