<script setup lang="ts">
defineProps<{
  /** Visible launch preference name. */
  label: string
  /** Multi-control fields align their label with the first input. */
  multiline?: boolean
}>()
defineSlots<{
  /** Launch preference control associated with the label. */
  default?: () => any
}>()
</script>

<template>
  <component :is="multiline ? 'div' : 'label'" :data-multiline="multiline" class="htw:group/launch-field htw:grid htw:items-center htw:data-[multiline=true]:items-start htw:grid-cols-[125px_minmax(0,1fr)] htw:gap-[12px] htw:[@media(max-width:600px)]:grid-cols-1 htw:[@media(max-width:600px)]:gap-[5px]">
    <span class="htw:text-muted htw:text-[12px] htw:group-data-[multiline=true]/launch-field:pt-[8px] htw:[@media(max-width:600px)]:pt-0">{{ label }}</span>
    <slot />
  </component>
</template>
