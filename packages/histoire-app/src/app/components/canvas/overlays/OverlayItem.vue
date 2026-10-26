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
  <div class="htw:absolute htw:inset-0 htw:pointer-events-none" :inert="contribution.interactive ? undefined : true">
    <!-- Overlay failures are recorded as host diagnostics; no panel states over the canvas. -->
    <ExtensionView :interactive="!!contribution.interactive" :classes="{ root: 'htw:absolute htw:inset-0', mount: 'htw:absolute htw:inset-0' }" :contribution="contribution" :context="context">
      <template #pending />
      <template #error />
    </ExtensionView>
  </div>
</template>
