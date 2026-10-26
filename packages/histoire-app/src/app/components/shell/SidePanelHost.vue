<script setup lang="ts">
import type { ShellPane } from '../../stores/shell.js'
import { useShell } from '../../composables/shell.js'
import PanelResizeHandle from './PanelResizeHandle.vue'

defineProps<{
  /** Stable region ID referenced by rail accessibility attributes. */
  id: string
  /** Current side-panel identity. */
  pane: ShellPane
  /** Visible name of the pane, used for the region's accessible name. */
  label?: string
}>()
const shell = useShell()
</script>

<template>
  <aside :id="id" class="htw:flex htw:flex-col htw:relative htw:min-w-0 htw:min-h-0 htw:z-1 htw:bg-surface htw:[@container(max-width:640px)]:absolute htw:[@container(max-width:640px)]:top-0 htw:[@container(max-width:640px)]:bottom-14 htw:[@container(max-width:640px)]:start-0 htw:[@container(max-width:640px)]:w-[var(--histoire-panel-width,280px)] htw:[@container(max-width:640px)]:max-w-[calc(100%-48px)] htw:[@container(max-width:640px)]:z-80 htw:[@container(max-width:640px)]:shadow-panel" :aria-label="`${label ?? (pane === 'ai' ? 'AI' : pane)} panel`">
    <div class="htw:flex htw:flex-col htw:flex-1 htw:min-w-0 htw:min-h-0 htw:overflow-hidden htw:border-e htw:border-border htw:[@container(max-width:640px)]:border-e-0">
      <slot />
    </div>
    <PanelResizeHandle :controls="id" label="Resize side panel" edge="end" :model-value="shell.panelWidth.value" :min="shell.panelWidthBounds.value.min" :max="shell.panelWidthBounds.value.max" @update:model-value="shell.setPanelWidth" />
  </aside>
</template>
