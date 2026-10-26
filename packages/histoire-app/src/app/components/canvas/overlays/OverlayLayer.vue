<script setup lang="ts">
import type { CanvasScopedContext, QualifiedContribution } from '@histoire/plugin-kit'
import { computed } from 'vue'
import { useCanvasStore } from '../../../composables/canvas-settings.js'
import ExtensionOutlet from '../../extensions/ExtensionOutlet.vue'
import OverlayItem from './OverlayItem.vue'

const props = defineProps<{
  /** `viewport`: viewport pixels; `canvas`: canvas space following pan and zoom. */
  space: 'viewport' | 'canvas'
  /** Canvas-scoped context of the viewport. */
  context: CanvasScopedContext
}>()
const canvas = useCanvasStore()
/** Canvas space maps to the viewport exactly like frames: translate by pan, then scale. */
const transform = computed(() => props.space === 'canvas' ? { transform: `translate(${canvas.panOffset.x}px, ${canvas.panOffset.y}px) scale(${canvas.effectiveZoom})` } : undefined)

/** Overlays of this layer's space. */
function inSpace(contribution: QualifiedContribution): boolean {
  return (contribution as QualifiedContribution<'canvas.overlay'>).space === props.space
}
</script>

<template>
  <div class="htw:absolute htw:inset-0 htw:z-[2] htw:origin-top-left htw:pointer-events-none" :data-space="space" :style="transform">
    <ExtensionOutlet kind="canvas.overlay" :context="context" :filter="inSpace">
      <template #default="{ contribution }">
        <OverlayItem :contribution="contribution as QualifiedContribution<'canvas.overlay'>" :context="context" />
      </template>
    </ExtensionOutlet>
  </div>
</template>
