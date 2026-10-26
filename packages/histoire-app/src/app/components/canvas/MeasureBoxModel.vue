<script setup lang="ts">
import type { HistoireElementSpacing } from '@histoire/shared'
import { computed } from 'vue'

const props = defineProps<{
  /** Element border box in client pixels. */
  box: { left: number, top: number, width: number, height: number }
  /** Computed padding in frame CSS pixels. */
  padding: HistoireElementSpacing
  /** Computed margin in frame CSS pixels. */
  margin: HistoireElementSpacing
  /** Frame-to-client scale per axis. */
  scale: { x: number, y: number }
}>()

/** Spacing as border widths, so one element tints the whole ring without covering content. */
function ring(spacing: HistoireElementSpacing): string {
  const { x, y } = props.scale
  // Negative margins can't be drawn as a ring.
  return [spacing.top * y, spacing.right * x, spacing.bottom * y, spacing.left * x].map(value => `${Math.max(0, value)}px`).join(' ')
}

const paddingStyle = computed(() => ({
  left: `${props.box.left}px`,
  top: `${props.box.top}px`,
  width: `${props.box.width}px`,
  height: `${props.box.height}px`,
  borderWidth: ring(props.padding),
}))

const marginStyle = computed(() => {
  const { x, y } = props.scale
  const margin = props.margin
  return {
    left: `${props.box.left - Math.max(0, margin.left) * x}px`,
    top: `${props.box.top - Math.max(0, margin.top) * y}px`,
    width: `${props.box.width + (Math.max(0, margin.left) + Math.max(0, margin.right)) * x}px`,
    height: `${props.box.height + (Math.max(0, margin.top) + Math.max(0, margin.bottom)) * y}px`,
    borderWidth: ring(margin),
  }
})
</script>

<template>
  <div class="margin htw:fixed htw:z-[25] htw:box-border htw:border-solid htw:pointer-events-none htw:[border-color:rgb(var(--histoire-measure-margin-rgb)_/_.25)]" :style="marginStyle" />
  <div class="padding htw:fixed htw:z-[25] htw:box-border htw:border-solid htw:pointer-events-none htw:[border-color:rgb(var(--histoire-measure-padding-rgb)_/_.3)]" :style="paddingStyle" />
</template>
