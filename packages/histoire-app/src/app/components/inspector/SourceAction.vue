<script setup lang="ts">
import { HstButton } from '@histoire/controls/vue'

defineSlots<{
  /** Source action icon and accessible label. */
  default?: () => any
}>()
</script>

<template>
  <HstButton icon-only color="flat" type="button" class="htw:[--histoire-icon-button-size:26px] htw:text-muted">
    <slot />
  </HstButton>
</template>
