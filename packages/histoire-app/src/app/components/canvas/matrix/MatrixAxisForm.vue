<script setup lang="ts">
withDefaults(defineProps<{
  /** New axes submit natively; existing axes use a grouped editor. */
  as?: 'form' | 'div'
}>(), { as: 'div' })
defineSlots<{
  /** Axis editor fields and validation feedback. */
  default?: () => any
}>()
</script>

<template>
  <component :is="as" class="htw:grid htw:gap-2 htw:min-w-0 htw:p-2.5 htw:border htw:border-solid htw:border-border htw:rounded-panel htw:[--histoire-control-margin:0px] htw:[--histoire-control-wrapper-padding:0px] htw:[--histoire-control-gap:6px]">
    <slot />
  </component>
</template>
