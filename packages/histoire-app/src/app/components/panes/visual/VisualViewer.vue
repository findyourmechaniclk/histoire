<script setup lang="ts">
import type { VisualSizing, VisualView } from './viewer-types.js'
import { HstButton } from '@histoire/controls/vue'
import { useHistoireSnapshot } from '@histoire/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useWorkbenchVisual } from '../../../stores/visual.js'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'
import WorkbenchErrorState from '../../shell/WorkbenchErrorState.vue'
import { restoreVisualViewerFocus, trapVisualViewerFocus } from './viewer-focus.js'
import VisualImageLabel from './VisualImageLabel.vue'
import VisualSlider from './VisualSlider.vue'
import VisualViewerActions from './VisualViewerActions.vue'
import VisualViewerDock from './VisualViewerDock.vue'
import VisualViewerHeader from './VisualViewerHeader.vue'
import { clampVisualZoom, fitVisualZoom } from './zoom.js'

const model = useWorkbenchVisual()!
const result = model.selectedResult
const snapshot = useHistoireSnapshot()
const storyTitle = computed(() => snapshot.value.catalog.stories.find(story => story.id === result.value?.case.storyId)?.title ?? result.value?.case.storyId)
const root = ref<HTMLElement>()
const board = ref<HTMLElement>()
const view = ref<VisualView>('slider')
const opacity = ref(50)
const zoom = ref(1)
/** `auto` shrinks large images to fit, `fit` also enlarges small ones, `manual` keeps user zoom. */
const sizing = ref<VisualSizing>('auto')
const id = useId()
let restore: HTMLElement | null = null
let observer: ResizeObserver | undefined
let pan: { element: HTMLElement, x: number, y: number, left: number, top: number } | undefined
const index = computed(() => model.results.value.findIndex(item => item.id === result.value?.id))
const images = computed(() => view.value === 'diff' ? ['diff'] as const : ['baseline', 'current'] as const)
/** Failed captures replace empty image board and own their recovery action. */
const captureFailed = computed(() => !!result.value && !result.value.images.current && (result.value.status === 'error' || !!result.value.error))
/** Opaque artifacts are served by existing generation-owned same-origin router. */
function imageUrl(kind: 'baseline' | 'current' | 'diff'): string | undefined {
  const name = result.value?.images[kind]
  return name ? `${import.meta.env.BASE_URL}__histoire/visual/${result.value?.artifactRunId ?? model.run.value?.id}/${name}` : undefined
}
/** Zoom uses actual dimensions, preserving mismatch rather than resizing images. */
function imageStyle(kind: 'baseline' | 'current' | 'diff') {
  const dimensions = kind === 'baseline' ? result.value?.baselineDimensions : result.value?.currentDimensions
  return { width: `${(dimensions?.width ?? 0) * zoom.value}px`, height: `${(dimensions?.height ?? 0) * zoom.value}px` }
}
/** Recompute shared baseline/current scale from measured image pane unless user zoomed manually. */
function applySizing(): void {
  if (sizing.value === 'manual') {
    return
  }
  const pane = board.value?.querySelector<HTMLElement>('.image-scroll')
  const dimensions = [result.value?.baselineDimensions, result.value?.currentDimensions].filter(size => !!size)
  if (!pane) return
  // Padding reserves shadow space inside the real scroll pane, outside fitted image pixels.
  const style = getComputedStyle(pane)
  const width = pane.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
  const height = pane.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)
  const next = fitVisualZoom({ width, height }, dimensions, sizing.value === 'fit')
  if (next) {
    zoom.value = next
  }
}
/** Fit fills pane, enlarging small images; stays fitted across resizes and results. */
function fit(): void {
  sizing.value = 'fit'
  applySizing()
}
/** Manual zoom step; Reset passes no factor to return to natural size. */
function setZoom(factor?: number): void {
  sizing.value = 'manual'
  zoom.value = factor ? clampVisualZoom(zoom.value * factor) : 1
}
/** Result paging remains inside run, without changing story selection. */
function move(direction: number): void {
  const next = model.results.value[index.value + direction]
  if (next) {
    root.value?.focus({ preventScroll: true })
    model.selectedResultId.value = next.id
  }
}
/** Dismiss restores original trigger when it still belongs to live DOM. */
function close(): void {
  model.viewerOpen.value = false
  if (root.value) restoreVisualViewerFocus(root.value.ownerDocument, restore)
}
/** Keep keyboard owner stable while approval removes or disables its trigger. */
async function approve(): Promise<void> {
  const selected = result.value
  if (!selected) return
  root.value?.focus({ preventScroll: true })
  await model.approve([selected.id])
}
/** Retry keeps focus inside dialog when successful capture removes error actions. */
async function rerun(): Promise<void> {
  const selected = result.value
  if (!selected) return
  root.value?.focus({ preventScroll: true })
  await model.rerun(selected)
}
/** Equal images share scroll positions; different dimensions keep independent pixel geometry. */
function synchronize(event: Event): void {
  if (view.value !== 'pair' || !board.value || result.value?.baselineDimensions?.width !== result.value?.currentDimensions?.width || result.value?.baselineDimensions?.height !== result.value?.currentDimensions?.height) {
    return
  }
  const source = event.currentTarget as HTMLElement
  for (const pane of board.value.querySelectorAll<HTMLElement>('.image-scroll')) {
    if (pane !== source) {
      pane.scrollLeft = source.scrollLeft
      pane.scrollTop = source.scrollTop
    }
  }
}
/** Pointer dragging pans image buffers, not live story canvas. */
function startPan(event: PointerEvent): void {
  if (event.button !== 0) {
    return
  }
  const element = event.currentTarget as HTMLElement
  pan = { element, x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop }
  element.setPointerCapture(event.pointerId)
  event.preventDefault()
}
/** Pointer movement stays inside captured review scroll owner. */
function movePan(event: PointerEvent): void {
  if (!pan) {
    return
  }
  pan.element.scrollLeft = pan.left - event.clientX + pan.x
  pan.element.scrollTop = pan.top - event.clientY + pan.y
}
/** Escape closes review; Tab retains keyboard focus inside viewer controls. */
function keyboard(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close()
  }
  else
    if (root.value) {
      trapVisualViewerFocus(event, root.value)
    }
}
watch([result, view], () => {
  if ((view.value === 'diff' && !result.value?.images.diff) || (['overlay', 'slider'].includes(view.value) && !result.value?.images.baseline)) view.value = 'pair'
  void nextTick(applySizing)
}, { immediate: true })
onMounted(() => {
  restore = root.value?.ownerDocument.activeElement as HTMLElement | null
  root.value?.focus()
  observer = new ResizeObserver(applySizing)
  if (board.value) {
    observer.observe(board.value)
  }
  applySizing()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  if (root.value) restoreVisualViewerFocus(root.value.ownerDocument, restore)
})
</script>

<template>
  <section ref="root" class="htw:absolute htw:inset-3 htw:z-[100] htw:flex htw:flex-col htw:min-w-0 htw:min-h-0 htw:bg-canvas htw:[background-image:radial-gradient(color-mix(in_srgb,_var(--histoire-muted)_18%,_transparent)_1px,_transparent_1px)] htw:[background-size:18px_18px] htw:text-text htw:border htw:border-solid htw:border-border htw:rounded-[16px] htw:shadow-panel htw:overflow-hidden htw:@container/viewer" role="dialog" aria-modal="false" :aria-labelledby="`${id}-title`" tabindex="-1" @keydown="keyboard">
    <VisualViewerHeader :title-id="`${id}-title`" :title="result?.case.kind === 'matrix' ? `${storyTitle} › ${result.case.label}` : result?.case.label ?? 'Visual results'" :index="index" :capture-failed="captureFailed" @move="move" @close="close" />
    <div ref="board" class="htw:flex htw:flex-1 htw:min-h-0 htw:gap-4 htw:py-0 htw:px-6 htw:overflow-hidden htw:@max-[640px]/viewer:p-0 htw:@max-[640px]/viewer:gap-1" :data-view="view">
      <figure v-if="result?.images.current && (view === 'slider' || view === 'overlay')" class="htw:flex htw:flex-1 htw:m-0 htw:min-w-0 htw:min-h-0">
        <div class="image-scroll htw:flex htw:flex-1 htw:overflow-auto htw:min-w-0 htw:min-h-0 htw:pt-9 htw:px-6 htw:pb-6 htw:cursor-grab htw:touch-none htw:active:[cursor:grabbing] htw:@max-[640px]/viewer:pt-8 htw:@max-[640px]/viewer:px-3 htw:@max-[640px]/viewer:pb-3" tabindex="0" aria-label="Pan compared images" @pointerdown="startPan" @pointermove="movePan" @pointerup="pan = undefined" @lostpointercapture="pan = undefined">
          <!-- Auto margins collapse during manual zoom, keeping image edges reachable. -->
          <div class="htw:relative htw:flex-none htw:m-auto">
            <template v-if="view === 'slider'">
              <VisualImageLabel label="Baseline" />
              <VisualImageLabel label="Current" right />
              <VisualSlider class="htw:relative htw:flex-none htw:w-max htw:h-max htw:rounded-[6px] htw:overflow-clip htw:shadow-[0_24px_64px_rgb(0_0_0_/_35%)]" :baseline-url="imageUrl('baseline')" :current-url="imageUrl('current')" :baseline-style="imageStyle('baseline')" :current-style="imageStyle('current')" :label="result.case.label" />
            </template>
            <template v-else>
              <VisualImageLabel label="Overlay" />
              <div class="htw:relative htw:flex-none htw:w-max htw:h-max htw:rounded-[6px] htw:overflow-clip htw:shadow-[0_24px_64px_rgb(0_0_0_/_35%)] htw:grid">
                <img class="htw:block htw:max-w-none htw:select-none htw:col-start-1 htw:row-start-1" :src="imageUrl('baseline')" :alt="`baseline image for ${result.case.label}`" :style="imageStyle('baseline')" draggable="false">
                <img class="htw:block htw:max-w-none htw:select-none htw:col-start-1 htw:row-start-1" :src="imageUrl('current')" :alt="`current image for ${result.case.label}`" :style="[imageStyle('current'), { opacity: opacity / 100 }]" draggable="false">
              </div>
            </template>
          </div>
        </div>
      </figure>
      <template v-else-if="result?.images.current">
        <figure v-for="kind in images" :key="kind" class="htw:flex htw:flex-1 htw:m-0 htw:min-w-0 htw:min-h-0" :data-kind="kind">
          <div class="image-scroll htw:flex htw:flex-1 htw:overflow-auto htw:min-w-0 htw:min-h-0 htw:pt-9 htw:px-6 htw:pb-6 htw:cursor-grab htw:touch-none htw:active:[cursor:grabbing] htw:@max-[640px]/viewer:pt-8 htw:@max-[640px]/viewer:px-3 htw:@max-[640px]/viewer:pb-3" tabindex="0" :aria-label="`Pan ${kind} image`" @scroll="synchronize" @pointerdown="startPan" @pointermove="movePan" @pointerup="pan = undefined" @lostpointercapture="pan = undefined">
            <div v-if="imageUrl(kind)" class="htw:relative htw:flex-none htw:m-auto">
              <VisualImageLabel :label="kind === 'baseline' ? 'Baseline' : kind === 'current' ? 'Current' : 'Diff'" :dimensions="kind === 'baseline' ? result.baselineDimensions : undefined" />
              <div class="htw:relative htw:flex-none htw:w-max htw:h-max htw:rounded-[6px] htw:overflow-clip htw:shadow-[0_24px_64px_rgb(0_0_0_/_35%)]">
                <img class="htw:block htw:max-w-none htw:select-none" :src="imageUrl(kind)" :alt="`${kind} image for ${result.case.label}`" :style="imageStyle(kind)" draggable="false">
              </div>
            </div>
            <WorkbenchEmptyState v-else fill icon="camera" title="No baseline" />
          </div>
        </figure>
      </template>
      <WorkbenchErrorState v-else-if="captureFailed" fill title="Screenshot failed">
        <template v-if="result?.error" #default>
          {{ result.error }}
        </template>
        <template #actions>
          <HstButton color="flat" tone="danger" :disabled="!!model.requestId.value || (result && model.approvalPending(result))" @click="rerun">
            Run again
          </HstButton>
        </template>
      </WorkbenchErrorState>
      <WorkbenchEmptyState v-else fill icon="camera" title="No captured image" />
    </div>
    <div class="htw:relative htw:z-[2] htw:grid htw:[grid-template-columns:minmax(0,_1fr)_auto_minmax(0,_1fr)] htw:items-end htw:gap-3 htw:pt-2 htw:px-3.5 htw:pb-3.5 htw:@max-[1200px]/viewer:flex htw:@max-[1200px]/viewer:flex-wrap htw:@max-[1200px]/viewer:items-center htw:@max-[1200px]/viewer:justify-center htw:@max-[640px]/viewer:flex-col htw:@max-[640px]/viewer:gap-2 htw:@max-[640px]/viewer:pt-2 htw:@max-[640px]/viewer:px-2.5 htw:@max-[640px]/viewer:pb-2.5">
      <VisualViewerDock v-model:view="view" v-model:opacity="opacity" :zoom="zoom" :sizing="sizing" @zoom="setZoom" @fit="fit" />
      <VisualViewerActions :capture-failed="captureFailed" @approve="approve" @rerun="rerun" />
    </div>
  </section>
</template>
