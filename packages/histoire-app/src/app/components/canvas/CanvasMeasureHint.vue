<script setup lang="ts">
import { BuiltinIcon } from '@histoire/controls/vue'
import { ref, watch } from 'vue'
import { useCanvasStore } from '../../composables/canvas-settings.js'

import CanvasHintBar from './CanvasHintBar.vue'
import CanvasHintButton from './CanvasHintButton.vue'
import CanvasHintItem from './CanvasHintItem.vue'
import CanvasHintKey from './CanvasHintKey.vue'

const canvas = useCanvasStore()
const pathElement = ref<HTMLElement>()

// Long breadcrumbs scroll; keep the measured element (last entry) in view.
watch(() => canvas.measure?.path, () => {
  pathElement.value?.scrollTo({ left: pathElement.value.scrollWidth })
}, { flush: 'post' })

/** Ancestor levels between the locked element and breadcrumb entry `index`. */
function depth(index: number): number {
  return (canvas.measure?.path.length ?? 0) - 1 - index
}
</script>

<template>
  <CanvasHintBar stacked role="toolbar" aria-label="Locked measurement">
    <nav v-if="canvas.measure?.path.length" ref="pathElement" class="measure-path htw:[line-height:normal] htw:flex htw:flex-none htw:items-center htw:gap-0.5 htw:min-w-0 htw:overflow-x-auto htw:overflow-y-hidden htw:[scrollbar-width:none] htw:font-mono htw:text-[11px]" aria-label="Measured element">
      <template v-for="(label, index) in canvas.measure.path" :key="index">
        <BuiltinIcon v-if="index" icon="chevron-right" :size="12" class="htw:flex-none htw:text-muted" />
        <CanvasHintButton v-if="depth(index)" breadcrumb @click="canvas.measure?.navigate('parent', depth(index))">
          {{ label }}
        </CanvasHintButton>
        <strong v-else class="htw:inline-flex htw:items-center htw:box-border htw:h-6 htw:px-[7px] htw:border htw:border-solid htw:border-transparent htw:rounded-[6px] htw:leading-4 htw:text-text htw:font-semibold htw:flex-none" aria-current="location">{{ label }}</strong>
      </template>
    </nav>
    <div class="htw:flex htw:flex-wrap htw:items-center htw:gap-0.5">
      <CanvasHintButton aria-pressed="true" title="Unlock measurement" @click="canvas.measure?.unlock()">
        <BuiltinIcon icon="locked" :size="14" />Locked
      </CanvasHintButton>
      <CanvasHintButton @click="canvas.measure?.navigate('parent')">
        <BuiltinIcon icon="arrow-up" :size="14" />Parent
      </CanvasHintButton>
      <CanvasHintButton @click="canvas.measure?.navigate('child')">
        <BuiltinIcon icon="arrow-down" :size="14" />First child
      </CanvasHintButton>
      <CanvasHintButton :disabled="!canvas.measure?.siblings" @click="canvas.measure?.navigate('previous')">
        <BuiltinIcon icon="chevron-left" :size="14" />Previous
      </CanvasHintButton>
      <CanvasHintButton :disabled="!canvas.measure?.siblings" @click="canvas.measure?.navigate('next')">
        Next<BuiltinIcon icon="chevron-right" :size="14" />
      </CanvasHintButton>
      <CanvasHintItem>
        <CanvasHintKey>⇧</CanvasHintKey> + hover compare
      </CanvasHintItem>
    </div>
  </CanvasHintBar>
</template>
