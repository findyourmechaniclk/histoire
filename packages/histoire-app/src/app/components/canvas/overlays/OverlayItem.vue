<script setup lang="ts">
import type { QualifiedContribution } from '@histoire/plugin-kit'
import ExtensionView from '../../extensions/ExtensionView.vue'

defineProps<{
  /** Overlay contribution (`canvas.overlay` or `canvas.frame-overlay`). */
  contribution: QualifiedContribution<'canvas.overlay' | 'canvas.frame-overlay'>
  /** Context pushed to the overlay view. */
  context: unknown
}>()
</script>

<template>
  <!--
    The item box never takes pointer input itself. Passive overlays are inert, so hit testing
    and focus always pass through to story frames; interactive overlays receive input only on
    the elements they render.
  -->
  <div class="histoire-canvas-overlay-item" :class="{ 'is-interactive': contribution.interactive }" :inert="contribution.interactive ? undefined : true">
    <!-- Overlay failures are recorded as host diagnostics; no panel states over the canvas. -->
    <ExtensionView :contribution="contribution" :context="context">
      <template #pending />
      <template #error />
    </ExtensionView>
  </div>
</template>

<style scoped>
.histoire-canvas-overlay-item { position: absolute; inset: 0; pointer-events: none; }
.histoire-canvas-overlay-item :deep(.histoire-extension-view), .histoire-canvas-overlay-item :deep(.histoire-extension-mount) { position: absolute; inset: 0; }
.histoire-canvas-overlay-item:not(.is-interactive) :deep(*) { pointer-events: none !important; }
.is-interactive :deep(.histoire-extension-view > :not(.histoire-extension-mount)), .is-interactive :deep(.histoire-extension-mount > *) { pointer-events: auto; }
</style>
