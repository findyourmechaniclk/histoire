<script setup lang="ts">
import type { VisualSize } from './zoom.js'

defineProps<{
  /** Image or comparison name. */
  label: string
  /** Optional original baseline size. */
  dimensions?: VisualSize
  /** Align label with frame's right edge (slider's Current side). */
  right?: boolean
}>()
</script>

<template>
  <span class="htw:absolute htw:left-0 htw:bottom-full htw:mb-2 htw:max-w-full htw:text-muted htw:text-[11px] htw:font-semibold htw:whitespace-nowrap htw:overflow-hidden htw:text-ellipsis htw:pointer-events-none htw:data-[right]:left-auto htw:data-[right]:right-0" :data-right="right || undefined">{{ label }}<span v-if="dimensions"> · {{ dimensions.width }} × {{ dimensions.height }}</span></span>
</template>
