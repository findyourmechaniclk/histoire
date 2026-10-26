<script setup lang="ts">
import type { CanvasScopedContext, QualifiedContribution } from '@histoire/plugin-kit'
import type { WorkbenchHost } from '../../../extensions/create-workbench-host.js'
import { useCanvasFrames, useCanvasStore } from '../../../composables/canvas-settings.js'
import ExtensionOutlet from '../../extensions/ExtensionOutlet.vue'
import { useFrameOverlayTargets } from './frame-overlays.js'
import OverlayItem from './OverlayItem.vue'

const props = defineProps<{
  /** Workbench extension host owning frame scopes. */
  workbench: WorkbenchHost
  /** Canvas-scoped context of the viewport. */
  context: CanvasScopedContext
}>()
const { targets } = useFrameOverlayTargets({ workbench: props.workbench, canvas: useCanvasStore(), frames: useCanvasFrames(), service: props.context.canvas })
</script>

<template>
  <div class="htw:absolute htw:inset-0 htw:z-[2] htw:overflow-hidden htw:pointer-events-none">
    <div v-for="target in targets" :key="target.key" class="htw:absolute htw:pointer-events-none" :data-frame-key="target.context.frame.key" :style="{ left: `${target.box.left}px`, top: `${target.box.top}px`, width: `${target.box.width}px`, height: `${target.box.height}px` }">
      <ExtensionOutlet kind="canvas.frame-overlay" :context="target.context">
        <template #default="{ contribution }">
          <OverlayItem :contribution="contribution as QualifiedContribution<'canvas.frame-overlay'>" :context="target.context" />
        </template>
      </ExtensionOutlet>
    </div>
  </div>
</template>
