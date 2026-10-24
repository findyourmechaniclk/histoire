<script setup lang="ts">
import type { CanvasScopedContext } from '@histoire/plugin-kit'
import type { CanvasPluginTools } from './plugin-tools.js'
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useCanvasFrames, useCanvasPointerPan } from '../../../composables/canvas-settings.js'
import { createPluginToolGesture, describeToolPointer } from './plugin-tool.js'

const props = defineProps<{
  /** Viewport plugin tools; the layer exists only while one is active. */
  tools: CanvasPluginTools
  /** Canvas-scoped context handed to tool handlers. */
  context: CanvasScopedContext
  /** Space held or a pan in progress: tool input is suspended and any gesture cancelled. */
  suspended: boolean
}>()
const frames = useCanvasFrames()
const gesture = createPluginToolGesture({
  pointerPan: useCanvasPointerPan(),
  tool: () => props.tools.active.value,
  context: () => props.context,
  describe: event => describeToolPointer(event, props.context.canvas, frames),
  fail: props.tools.fail,
})

/** Escape cancels the active gesture before global Escape handling sees it. */
function keydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !gesture.active()) return
  event.preventDefault()
  event.stopPropagation()
  gesture.cancel()
}

// Switching or removing the tool, or a pan takeover, ends the gesture and its capture.
watch(() => props.tools.active.value, (tool, previous) => {
  if (tool !== previous) gesture.cancel()
}, { flush: 'sync' })
watch(() => props.suspended, (suspended) => {
  if (suspended) gesture.cancel()
}, { flush: 'sync' })
onMounted(() => window.addEventListener('keydown', keydown, true))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keydown, true)
  gesture.retire()
})
</script>

<template>
  <!-- Covers frames so tool input never reaches story documents; canvas chrome stays above. -->
  <div class="histoire-plugin-tool-capture" :style="{ cursor: tools.active.value?.cursor ?? 'crosshair' }" :data-histoire-tool="tools.active.value?.id" @pointerdown="gesture.pointerDown" @pointermove="gesture.pointerMove" @pointerup="gesture.pointerUp" @pointercancel="gesture.pointerCancel" />
</template>

<style scoped>
.histoire-plugin-tool-capture { position: absolute; inset: 0; z-index: 2; touch-action: none; }
</style>
