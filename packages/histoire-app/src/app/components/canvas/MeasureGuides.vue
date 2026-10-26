<script setup lang="ts">
import type { MeasureSegment } from './measure-geometry.js'
import type { MeasureLabel } from './measure-labels.js'
import { isVerticalSegment } from './measure-geometry.js'

defineProps<{
  /** Distance lines already projected to client pixels. */
  segments: readonly MeasureSegment[]
  /** Size and distance labels, already laid out without overlaps. */
  labels: readonly MeasureLabel[]
}>()

/** Axis-aligned line box for one segment. */
function lineStyle(segment: MeasureSegment) {
  const vertical = isVerticalSegment(segment)
  return {
    left: `${Math.min(segment.x1, segment.x2)}px`,
    top: `${Math.min(segment.y1, segment.y2)}px`,
    width: vertical ? '1px' : `${Math.abs(segment.x2 - segment.x1)}px`,
    height: vertical ? `${Math.abs(segment.y2 - segment.y1)}px` : '1px',
  }
}
</script>

<template>
  <div v-for="segment in segments" :key="segment.id" class="htw:fixed htw:z-[26] htw:pointer-events-none htw:bg-measure htw:data-[equal]:bg-measure-gap" :data-equal="segment.equal || undefined" :style="lineStyle(segment)" />
  <span v-for="label in labels" :key="label.id" class="htw:fixed htw:z-[27] htw:box-border htw:h-[18px] htw:py-[3px] htw:px-[5px] htw:rounded-[4px] htw:bg-measure htw:text-white htw:font-mono htw:text-[10px] htw:leading-[12px] htw:whitespace-nowrap htw:pointer-events-none htw:data-[equal]:bg-measure-gap" :data-equal="label.equal || undefined" :style="{ left: `${label.x}px`, top: `${label.y}px` }">
    {{ label.text }}
  </span>
</template>
