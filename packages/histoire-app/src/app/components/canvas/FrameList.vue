<script setup lang="ts">
import type { CanvasFrameLayout } from './frame-layout.js'

/** List arrangement keeps one semantic row per variant; caller owns preview lifetime. */
defineProps<{ frames: readonly CanvasFrameLayout[] }>()
</script>

<template>
  <div class="htw:flex htw:flex-col" role="list" aria-label="Story variants">
    <div v-for="(frame, index) in frames" :key="frame.id" class="htw:min-w-0" role="listitem">
      <slot :frame="frame" :index="index" />
    </div>
  </div>
</template>
