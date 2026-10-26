<script setup lang="ts">
import { BuiltinIcon } from '@histoire/controls/vue'
import { useHistoireSnapshot } from '@histoire/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCanvasFrames, useCanvasStore } from '../../composables/canvas-settings.js'
import { useMcpStore } from '../../stores/mcp.js'
import { getMcpCursor } from './agent-cursor.js'

const mcp = useMcpStore()
const canvas = useCanvasStore()
const frames = useCanvasFrames()
const snapshot = useHistoireSnapshot()
const layer = ref<HTMLElement>()
const geometryVersion = ref(0)
const frame = computed(() => canvas.selectedFrame ? frames.getFrame(canvas.selectedFrame) : null)
const bounds = computed(() => {
  void geometryVersion.value
  const rect = layer.value?.getBoundingClientRect()
  return rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null
})
// Check activity first: layer bounds force layout and are only needed while an agent operation runs.
const position = computed(() => mcp.current && bounds.value ? getMcpCursor({ activity: mcp, snapshot: snapshot.value, canvas, frames, bounds: bounds.value }) : null)
let resize: ResizeObserver | undefined
let host: Window | null = null

/** DOM projection runs after canvas transforms commit, including pan and responsive geometry. */
function refreshGeometry(): void {
  geometryVersion.value++
}
watch(() => [
  canvas.panOffset.x,
  canvas.panOffset.y,
  canvas.effectiveZoom,
  canvas.inspectorWidth,
  canvas.viewport.width,
  canvas.viewport.height,
  frame.value?.rect.x,
  frame.value?.rect.y,
  frame.value?.rect.width,
  frame.value?.rect.height,
  frame.value?.iframe,
  frame.value?.documentId,
], refreshGeometry, { flush: 'post' })
onMounted(() => {
  host = layer.value?.ownerDocument.defaultView ?? null
  resize = new ResizeObserver(refreshGeometry)
  if (layer.value) resize.observe(layer.value)
  host?.addEventListener('resize', refreshGeometry)
  host?.addEventListener('scroll', refreshGeometry, true)
  refreshGeometry()
})
onBeforeUnmount(() => {
  resize?.disconnect()
  host?.removeEventListener('resize', refreshGeometry)
  host?.removeEventListener('scroll', refreshGeometry, true)
})
</script>

<template>
  <div ref="layer" class="histoire-agent-cursor-layer htw:absolute htw:inset-0 htw:z-[10] htw:overflow-hidden htw:pointer-events-none" :style="{ right: `${canvas.inspectorWidth}px` }" aria-hidden="true">
    <div v-if="mcp.current && position" class="htw:absolute htw:grid htw:justify-items-start htw:text-agent" :style="{ left: `${position.x}px`, top: `${position.y}px` }">
      <BuiltinIcon class="htw:[filter:drop-shadow(0_1px_1px_rgb(0_0_0_/_25%))]" icon="cursor-1" :size="20" />
      <span class="htw:ml-3 htw:max-w-[220px] htw:px-[7px] htw:py-[3px] htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap htw:rounded-[6px] htw:text-white htw:bg-agent htw:text-[11px] htw:font-semibold">{{ mcp.clientName(mcp.current.clientId) }} · {{ mcp.current.tool }}</span>
    </div>
  </div>
</template>
