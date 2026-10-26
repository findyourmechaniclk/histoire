<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'

defineProps<{
  /** Thread title. */
  title: string
}>()
const emit = defineEmits<{
  /** Return to the thread list. */
  back: []
}>()
defineSlots<{
  /** Trailing thread actions. */
  default?: () => any
}>()
</script>

<template>
  <header class="htw:flex htw:flex-none htw:items-center htw:gap-1 htw:pt-0 htw:px-pane-gutter htw:pb-pane-row-inset htw:border-b htw:border-solid htw:border-border">
    <HstButton class="htw:text-muted" icon-only color="flat" type="button" aria-label="Back to threads" title="Back" @click="emit('back')">
      <BuiltinIcon icon="chevron-left" :size="16" />
    </HstButton>
    <h3 class="htw:flex-1 htw:min-w-0 htw:m-0 htw:overflow-hidden htw:text-[13px] htw:font-bold htw:text-ellipsis htw:whitespace-nowrap" :title="title">
      {{ title }}
    </h3>
    <slot />
  </header>
</template>
