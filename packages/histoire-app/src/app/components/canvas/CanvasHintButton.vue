<script setup lang="ts">
import { HstButton } from '@histoire/controls/vue'

defineProps<{
  /** Breadcrumbs inherit the compact monospace path font. */
  breadcrumb?: boolean
}>()
defineSlots<{
  /** Accessible hint action or breadcrumb label. */
  default?: () => any
}>()
</script>

<template>
  <HstButton color="flat" class="htw:box-border htw:h-6 htw:gap-1 htw:px-[7px] htw:py-0 htw:rounded-[6px] htw:leading-4" :class="breadcrumb ? 'htw:font-mono htw:text-[11px] htw:[line-height:normal] htw:text-muted htw:flex-none' : 'htw:text-[12px]'">
    <slot />
  </HstButton>
</template>
