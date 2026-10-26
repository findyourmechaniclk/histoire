<script setup lang="ts">
import { BuiltinIcon } from '@histoire/controls/vue'

defineProps<{
  /** Short context kind. */
  label: string
  /** Offline glyph naming the context kind. */
  icon: string
  /** Full context shown on hover. */
  title: string
  /** Optional secondary metadata. */
  detail?: string
}>()
</script>

<template>
  <span class="htw:inline-flex htw:flex-[0_1_auto] htw:items-center htw:gap-1.25 htw:min-w-0 htw:h-5.5 htw:py-0 htw:px-1.75 htw:rounded-[5px] htw:bg-chip htw:text-body htw:text-[11px] htw:leading-[1] htw:whitespace-nowrap" :title="title">
    <BuiltinIcon :icon="icon" :size="13" class="htw:flex-none htw:text-muted" />
    <span class="htw:min-w-0 htw:overflow-hidden htw:text-ellipsis">{{ label }}<code v-if="detail" class="htw:ml-1.5 htw:text-muted htw:font-mono htw:text-[10.5px]">{{ detail }}</code></span>
  </span>
</template>
