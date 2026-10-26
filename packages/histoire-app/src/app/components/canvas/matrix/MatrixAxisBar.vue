<script setup lang="ts">
import { BuiltinIcon, HstButton, HstSelect } from '@histoire/controls/vue'
import { useMatrixStore } from '../../../stores/matrix.js'
import MatrixVisualActions from './MatrixVisualActions.vue'

const emit = defineEmits<{ axes: [value: { rows: string, cols: string }] }>()
const matrix = useMatrixStore()

/** Axis controls publish optional URL intent through standalone parent. */
function select(dimension: 'rows' | 'cols', value: string): void {
  matrix.selectAxes(dimension === 'rows' ? value : matrix.rows.value, dimension === 'cols' ? value : matrix.cols.value)
  emit('axes', { rows: matrix.rows.value, cols: matrix.cols.value })
}

/** Swapping preserves value filters attached to exact axis names. */
function swap(): void {
  matrix.swapAxes()
  emit('axes', { rows: matrix.rows.value, cols: matrix.cols.value })
}
</script>

<template>
  <div class="htw:flex htw:items-center htw:gap-3 htw:min-w-0 htw:h-9 htw:text-muted htw:text-[11px]" @pointerdown.stop @wheel.stop>
    <HstSelect class="htw:flex-[0_1_200px] htw:min-w-[160px] htw:[--histoire-control-wrapper-padding:0px] htw:[--histoire-control-margin:0px]" title="Rows" layout="horizontal" :model-value="matrix.rows.value" :options="matrix.usableAxes.value.map(axis => ({ value: axis.name, label: axis.name, disabled: axis.name === matrix.cols.value }))" @update:model-value="select('rows', $event)" />
    <HstButton class="htw:[--histoire-icon-button-size:28px]" icon-only color="flat" type="button" aria-label="Swap matrix axes" @click="swap">
      <BuiltinIcon icon="arrows-horizontal" :size="16" />
    </HstButton>
    <HstSelect class="htw:flex-[0_1_200px] htw:min-w-[160px] htw:[--histoire-control-wrapper-padding:0px] htw:[--histoire-control-margin:0px]" title="Columns" layout="horizontal" :model-value="matrix.cols.value" :options="matrix.usableAxes.value.map(axis => ({ value: axis.name, label: axis.name, disabled: axis.name === matrix.rows.value }))" @update:model-value="select('cols', $event)" />
    <MatrixVisualActions scope="all" />
    <span class="histoire-matrix-base-summary htw:flex htw:gap-1.5 htw:overflow-hidden htw:ms-auto htw:py-1.5 htw:px-2.5 htw:[border:1px_dashed_var(--histoire-border)] htw:rounded-[7px] htw:whitespace-nowrap htw:[@container_matrix-axis_(max-width:900px)]:hidden">Base props <code v-for="(value, name) in matrix.base.value" :key="name" class="htw:text-text">{{ name }}={{ JSON.stringify(value) }}</code></span>
  </div>
</template>
