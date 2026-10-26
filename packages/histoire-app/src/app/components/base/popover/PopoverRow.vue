<script setup lang="ts">
import { HstButton } from '@histoire/controls/vue'

withDefaults(defineProps<{
  /** Native label for a field row, or a flat action button by default. */
  as?: 'button' | 'label'
}>(), { as: 'button' })
defineSlots<{
  /** Row label, icon, value or field. Native attributes and events fall through. */
  default?: () => any
}>()
</script>

<template>
  <!-- Row geometry is explicit; shared button styles provide the remaining defaults. -->
  <component :is="as === 'label' ? 'label' : HstButton" :color="as === 'button' ? 'flat' : undefined" class="htw:flex htw:w-full htw:min-h-8 htw:gap-[9px] htw:items-center htw:justify-start htw:py-1.5 htw:px-2 htw:text-start">
    <slot />
  </component>
</template>
