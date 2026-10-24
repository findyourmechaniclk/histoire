<script setup lang="ts">
import { injectCanvasExtensions } from '../canvas-extensions.js'
import PluginToolLayer from '../tools/PluginToolLayer.vue'
import FrameLayer from './FrameLayer.vue'
import OverlayLayer from './OverlayLayer.vue'

defineProps<{
  /** Space held or a pan in progress; suspends plugin tool input. */
  panning: boolean
}>()
const extensions = injectCanvasExtensions()
</script>

<template>
  <!-- Stacking follows DOM order: tool capture below overlays, so interactive overlays stay reachable. -->
  <template v-if="extensions?.workbench && extensions.context">
    <PluginToolLayer v-if="extensions.tools.active.value" :tools="extensions.tools" :context="extensions.context" :suspended="panning" />
    <FrameLayer v-if="extensions.has('canvas.frame-overlay')" :workbench="extensions.workbench" :context="extensions.context" />
    <OverlayLayer v-if="extensions.has('canvas.overlay')" space="canvas" :context="extensions.context" />
    <OverlayLayer v-if="extensions.has('canvas.overlay')" space="viewport" :context="extensions.context" />
  </template>
</template>
