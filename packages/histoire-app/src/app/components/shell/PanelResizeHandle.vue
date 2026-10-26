<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, onBeforeUnmount, ref } from 'vue'
import { createPanelResizeController } from './panel-resize.js'

const props = defineProps<{
  /** Accessible label names the panel being resized. */
  label: string
  /** Region controlled by this separator. */
  controls: string
  /** Logical edge where the drag handle is rendered. */
  edge: 'start' | 'end'
  /** Effective width rendered by the parent. */
  modelValue: number
  /** Current minimum inline size within the host. */
  min: number
  /** Current maximum inline size within the host. */
  max: number
}>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const handle = ref<HTMLElement>()
const ownerDocument = computed(() => handle.value?.ownerDocument)
const ownerWindow = computed(() => ownerDocument.value?.defaultView ?? undefined)
const controller = createPanelResizeController({ edge: props.edge, getWidth: () => props.modelValue, getBounds: () => ({ min: props.min, max: props.max }), setWidth: value => emit('update:modelValue', value), getDirection: () => ownerWindow.value?.getComputedStyle(handle.value!).direction === 'rtl' ? 'rtl' : 'ltr' })
useEventListener(ownerDocument, 'pointermove', controller.onPointerMove, { capture: true, passive: false })
useEventListener(ownerDocument, ['pointerup', 'pointercancel'], controller.onPointerEnd, { capture: true })
useEventListener(ownerWindow, 'blur', controller.release)
onBeforeUnmount(controller.close)
</script>

<template>
  <div ref="handle" class="htw:absolute htw:inset-y-0 htw:w-2 htw:z-2 htw:cursor-col-resize htw:touch-none htw:select-none htw:data-[edge=end]:-end-1 htw:data-[edge=start]:-start-1 htw:after:content-[''] htw:after:absolute htw:after:inset-y-0 htw:after:start-[calc(50%-0.5px)] htw:after:w-px htw:after:bg-transparent htw:hover:after:bg-accent htw:data-[resizing=true]:after:bg-accent htw:focus-visible:after:bg-accent htw:focus-visible:outline-2 htw:focus-visible:outline-accent htw:focus-visible:-outline-offset-2" :data-edge="edge" :data-resizing="controller.active.value" role="separator" tabindex="0" aria-orientation="vertical" :aria-label="label" :aria-controls="controls" :aria-valuenow="modelValue" :aria-valuemin="min" :aria-valuemax="max" :aria-valuetext="`${Math.round(modelValue)} pixels`" @pointerdown="controller.onPointerDown" @lostpointercapture="controller.onPointerEnd" @keydown="controller.onKeyDown" />
</template>
