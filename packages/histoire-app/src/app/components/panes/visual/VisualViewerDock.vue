<script setup lang="ts">
import type { VisualSizing, VisualView } from './viewer-types.js'
import { BuiltinIcon } from '@histoire/controls/vue'
import { useWorkbenchVisual } from '../../../stores/visual.js'
import VisualViewerDockButton from './VisualViewerDockButton.vue'
import VisualViewerSurface from './VisualViewerSurface.vue'

defineProps<{
  /** Current image layout. */
  view: VisualView
  /** Shared image scale. */
  zoom: number
  /** Determines whether Fit remains selected. */
  sizing: VisualSizing
  /** Current layer opacity percentage. */
  opacity: number
}>()
const emit = defineEmits<{
  /** Select an available comparison layout. */
  'update:view': [view: VisualView]
  /** Adjust current layer's opacity. */
  'update:opacity': [opacity: number]
  /** Multiply manual zoom, or reset when factor is absent. */
  'zoom': [factor?: number]
  /** Fill measured image pane. */
  'fit': []
}>()
const result = useWorkbenchVisual()!.selectedResult
/** Offline Carbon glyphs for each comparison layout. */
const modes = [
  { value: 'pair', label: 'Side by side', icon: 'side-panel-open' },
  { value: 'diff', label: 'Diff', icon: 'compare' },
  { value: 'overlay', label: 'Overlay', icon: 'copy' },
  { value: 'slider', label: 'Slider', icon: 'arrows-horizontal' },
] as const
/** Layouts requiring absent artifacts cannot be selected. */
function unavailable(mode: VisualView): boolean {
  return mode === 'diff' ? !result.value?.images.diff : mode !== 'pair' && !result.value?.images.baseline
}
/** Native range values enter component state as numbers. */
function changeOpacity(event: Event): void {
  emit('update:opacity', Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <VisualViewerSurface class="htw:flex htw:items-center htw:justify-center htw:flex-wrap htw:gap-1 htw:p-1 htw:min-w-0 htw:max-w-full htw:[grid-column:2] htw:@max-[640px]/viewer:gap-y-1.5">
    <div class="htw:flex htw:items-center htw:gap-0.5" role="group" aria-label="Image comparison mode">
      <VisualViewerDockButton v-for="mode in modes" :key="mode.value" color="flat" :icon-only="view !== mode.value" :aria-label="mode.label" :aria-pressed="view === mode.value" :disabled="unavailable(mode.value)" @click="emit('update:view', mode.value)">
        <BuiltinIcon :icon="mode.icon" :size="16" />
        <span v-if="view === mode.value">{{ mode.label }}</span>
      </VisualViewerDockButton>
    </div>
    <span class="htw:w-[1px] htw:h-5 htw:my-0 htw:mx-1 htw:bg-border htw:@max-[640px]/viewer:hidden" aria-hidden="true" />
    <div class="htw:flex htw:items-center htw:gap-0.5">
      <VisualViewerDockButton color="flat" icon-only aria-label="Zoom out visual images" @click="emit('zoom', 1 / 1.25)">
        <BuiltinIcon icon="subtract" :size="16" />
      </VisualViewerDockButton>
      <code class="htw:min-w-11 htw:text-center htw:text-[12px]">{{ Math.round(zoom * 100) }}%</code>
      <VisualViewerDockButton color="flat" icon-only aria-label="Zoom in visual images" @click="emit('zoom', 1.25)">
        <BuiltinIcon icon="add" :size="16" />
      </VisualViewerDockButton>
    </div>
    <span class="htw:w-[1px] htw:h-5 htw:my-0 htw:mx-1 htw:bg-border htw:@max-[640px]/viewer:hidden" aria-hidden="true" />
    <div class="htw:flex htw:items-center htw:gap-0.5">
      <VisualViewerDockButton color="flat" aria-label="Reset visual images to natural size" @click="emit('zoom')">
        Reset
      </VisualViewerDockButton>
      <VisualViewerDockButton color="flat" :aria-pressed="sizing === 'fit'" @click="emit('fit')">
        Fit
      </VisualViewerDockButton>
    </div>
    <label v-if="view === 'overlay'" class="htw:flex htw:items-center htw:gap-1.5 htw:py-0 htw:px-1.5 htw:text-[11px] htw:text-muted">Opacity <input class="htw:w-22 htw:accent-accent" :value="opacity" type="range" min="0" max="100" aria-label="Overlay opacity" @input="changeOpacity"></label>
  </VisualViewerSurface>
</template>
