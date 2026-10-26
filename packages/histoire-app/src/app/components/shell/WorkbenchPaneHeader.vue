<script setup lang="ts">
defineProps<{
  /** Pane title. */
  title: string
}>()
defineSlots<{
  /** Trailing pane actions (icon buttons, `WorkbenchPanelAction`). */
  default?: () => any
}>()
</script>

<template>
  <header class="workbench-pane-header htw:flex htw:flex-none htw:items-center htw:gap-2 htw:box-border htw:h-pane-header htw:py-0 htw:px-pane-gutter">
    <h2 class="htw:flex-1 htw:min-w-0 htw:m-0 htw:truncate htw:text-text htw:text-[15px] htw:font-extrabold">
      {{ title }}
    </h2>
    <slot />
  </header>
</template>
