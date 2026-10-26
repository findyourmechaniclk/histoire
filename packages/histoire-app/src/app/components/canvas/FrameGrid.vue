<script setup lang="ts">
import type { CanvasFrameLayout } from './frame-layout.js'

defineProps<{
  /** Positioned frame registry retains placeholders and selection. */
  frames: readonly CanvasFrameLayout[]
}>()
</script>

<template>
  <div class="htw:absolute htw:inset-0 htw:pointer-events-none" role="group" aria-label="Story variants">
    <slot v-for="(frame, index) in frames" :key="frame.id" :frame="frame" :index="index" />
  </div>
</template>
