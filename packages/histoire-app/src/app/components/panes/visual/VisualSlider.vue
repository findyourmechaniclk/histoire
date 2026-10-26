<script setup lang="ts">
import type { StyleValue } from 'vue'
import { ref } from 'vue'

const props = defineProps<{
  /** Baseline image URL, shown left of separator. */
  baselineUrl?: string
  /** Current image URL, shown right of separator. */
  currentUrl?: string
  /** Zoomed baseline image size. */
  baselineStyle: StyleValue
  /** Zoomed current image size. */
  currentStyle: StyleValue
  /** Case label used in image alternative texts. */
  label?: string
}>()

const stage = ref<HTMLElement>()
/** Separator position as percentage of stage width. */
const position = ref(50)
let dragging = false

/** Map pointer horizontal coordinate to clamped separator percentage. */
function place(event: PointerEvent): void {
  const rect = stage.value?.getBoundingClientRect()
  if (rect?.width) {
    position.value = Math.min(100, Math.max(0, (event.clientX - rect.left) / rect.width * 100))
  }
}
/** Separator owns its pointer so image panning in parent scroll area does not start. */
function startDrag(event: PointerEvent): void {
  if (event.button !== 0) {
    return
  }
  event.stopPropagation()
  event.preventDefault()
  dragging = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  place(event)
}
/** Follow captured pointer while dragging. */
function drag(event: PointerEvent): void {
  if (dragging) {
    place(event)
  }
}
/** Arrow keys nudge separator; Shift moves faster; Home/End jump to edges. */
function keyboard(event: KeyboardEvent): void {
  const step = event.shiftKey ? 10 : 1
  const next = {
    ArrowLeft: position.value - step,
    ArrowRight: position.value + step,
    Home: 0,
    End: 100,
  }[event.key]
  if (next !== undefined) {
    event.preventDefault()
    position.value = Math.min(100, Math.max(0, next))
  }
}
</script>

<template>
  <div ref="stage" class="htw:relative htw:grid htw:w-max">
    <div class="htw:col-start-1 htw:row-start-1">
      <img v-if="props.baselineUrl" class="htw:block htw:max-w-none htw:select-none" :src="props.baselineUrl" :alt="`baseline image for ${props.label}`" :style="props.baselineStyle" draggable="false">
    </div>
    <div class="htw:col-start-1 htw:row-start-1" :style="{ clipPath: `inset(0 0 0 ${position}%)` }">
      <img v-if="props.currentUrl" class="htw:block htw:max-w-none htw:select-none" :src="props.currentUrl" :alt="`current image for ${props.label}`" :style="props.currentStyle" draggable="false">
    </div>
    <div
      class="htw:group/separator htw:absolute htw:top-0 htw:bottom-0 htw:flex htw:flex-col htw:justify-center htw:items-center htw:w-3 htw:ml-[-6px] htw:cursor-ew-resize htw:touch-none htw:before:[content:''] htw:before:absolute htw:before:top-0 htw:before:bottom-0 htw:before:left-[50%] htw:before:w-[1px] htw:before:[background:color-mix(in_srgb,_var(--histoire-code)_45%,_transparent)] htw:focus-visible:[outline:none]"
      role="slider"
      tabindex="0"
      aria-label="Baseline and current separator"
      aria-orientation="horizontal"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(position)"
      :style="{ left: `${position}%` }"
      @pointerdown="startDrag"
      @pointermove="drag"
      @pointerup="dragging = false"
      @lostpointercapture="dragging = false"
      @keydown="keyboard"
    >
      <!-- Opposing sticky insets keep grip centered inside the scrolling image. -->
      <span class="htw:sticky htw:top-[calc(50%_-_8px)] htw:bottom-[calc(50%_-_8px)] htw:w-1.5 htw:h-4 htw:rounded-[3px] htw:bg-code htw:shadow-[0_0_0_2px_light-dark(var(--histoire-surface),_var(--histoire-text)),_0_1px_2px_rgb(0_0_0_/_25%)] htw:group-focus-visible/separator:[outline:2px_solid_var(--histoire-text)] htw:group-focus-visible/separator:outline-offset-2" />
    </div>
  </div>
</template>
