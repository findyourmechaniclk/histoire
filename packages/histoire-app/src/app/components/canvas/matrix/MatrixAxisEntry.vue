<script setup lang="ts">
import type { MatrixValue } from '../../../util/matrix.js'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { computed, ref } from 'vue'
import { isNumericMatrixAxis } from '../../../stores/matrix-preferences.js'
import { useMatrixStore } from '../../../stores/matrix.js'
import { equalMatrixValue, formatMatrixCustomValues, formatMatrixValue, matrixValueKey } from '../../../util/matrix-values.js'
import { filterMatrixValues } from '../../../util/matrix.js'
import MatrixCustomValues from './MatrixCustomValues.vue'
import MatrixNumericValues from './MatrixNumericValues.vue'

const props = defineProps<{
  /** Exact axis name. */
  name: string
  /** Selected dimension; unselected custom axes render a compact summary without filters. */
  dimension?: 'rows' | 'cols'
}>()
const matrix = useMatrixStore()
const editor = matrix.axisEditor
const error = ref('')
const axis = computed(() => matrix.axes.value.find(axis => axis.name === props.name))
const custom = computed(() => Object.hasOwn(matrix.customAxes.value, props.name))
/** Custom axes always use the line editor, even when all values are numbers. */
const numeric = computed(() => !custom.value && !!axis.value && isNumericMatrixAxis(axis.value, matrix.props.value))
const open = computed(() => editor.editing.value === props.name && (custom.value || numeric.value))
const values = computed(() => matrix.customAxes.value[props.name] ?? axis.value?.values ?? [])
const filter = computed(() => props.dimension === 'rows' ? matrix.rowValues.value : props.dimension === 'cols' ? matrix.colValues.value : undefined)
/** Compact one-line summary using editor notation, so `"2"` and `2` stay distinct. */
const summary = computed(() => formatMatrixCustomValues(values.value).split('\n').join(', '))
const selected = computed(() => axis.value ? filterMatrixValues(axis.value, filter.value) : [])

/** Toggle this axis editor; opening it closes any other one. */
function toggle(): void {
  if (open.value) editor.close()
  else editor.edit(props.name)
}

/** Close this editor only when it still owns the shared editing slot. */
function close(): void {
  if (editor.editing.value === props.name) editor.close()
}

/** Axis subsets are multi-selection filters, including intentionally empty sets. */
function toggleValue(value: MatrixValue): void {
  if (!props.dimension || !axis.value) return
  const active = selected.value.some(item => equalMatrixValue(item, value))
  matrix.setFilter(props.dimension, active ? selected.value.filter(item => !equalMatrixValue(item, value)) : [...selected.value, value])
}

/** Removal restores current source defaults, or retires the axis entirely. */
function remove(): void {
  try {
    matrix.removeCustomAxis(props.name)
    error.value = ''
    close()
  }
  catch (cause) { error.value = (cause as Error).message }
}
</script>

<template>
  <div class="histoire-matrix-axis htw:grid htw:gap-2 htw:min-w-0 htw:mb-4" :data-open="open || undefined">
    <div class="htw:flex htw:items-center htw:gap-2 htw:min-w-0 htw:min-h-6 htw:font-mono htw:text-[11px]">
      <code class="htw:flex-none htw:text-text htw:text-[12px]">{{ name }}</code>
      <span v-if="dimension" class="htw:flex-1 htw:min-w-0 htw:overflow-hidden htw:text-muted htw:text-right htw:text-ellipsis htw:whitespace-nowrap htw:data-[accent]:text-accent-link" data-accent>{{ dimension === 'rows' ? 'rows' : 'columns' }} · {{ selected.length }} of {{ values.length }}</span>
      <span v-else class="htw:flex-1 htw:min-w-0 htw:overflow-hidden htw:text-muted htw:text-right htw:text-ellipsis htw:whitespace-nowrap htw:data-[accent]:text-accent-link" :title="summary">{{ summary }}</span>
      <span class="htw:flex htw:flex-none htw:gap-0.5 htw:me-[-4px] htw:empty:hidden">
        <HstButton v-if="custom || numeric" class="htw:[--histoire-icon-button-size:24px] htw:text-muted htw:hover:text-text htw:aria-pressed:text-text" icon-only color="flat" type="button" :aria-label="`Edit ${name} values`" title="Edit values" :aria-pressed="open" @click="toggle">
          <BuiltinIcon icon="edit" :size="14" />
        </HstButton>
        <HstButton v-if="custom" class="htw:[--histoire-icon-button-size:24px] htw:text-muted htw:hover:text-text htw:aria-pressed:text-text" icon-only color="flat" type="button" :aria-label="`Remove ${name} axis`" title="Remove custom axis" @click="remove">
          <BuiltinIcon icon="trash-can" :size="14" />
        </HstButton>
      </span>
    </div>
    <div v-if="dimension && axis" class="histoire-button-group-options" role="group" :aria-label="`${name} values`">
      <HstButton v-for="value in axis.values" :key="matrixValueKey(value)" class="htw:flex-1 htw:min-w-0 htw:overflow-hidden htw:text-ellipsis" :title="formatMatrixValue(value)" color="flat" type="button" :aria-pressed="selected.some(item => equalMatrixValue(item, value))" @click="toggleValue(value)">
        {{ formatMatrixValue(value) }}
      </HstButton>
    </div>
    <span v-if="error" class="htw:text-danger htw:text-[12px]" role="alert">{{ error }}</span>
    <MatrixCustomValues v-if="open && custom" :name="name" @close="close" />
    <MatrixNumericValues v-else-if="open" :key="name" :name="name" @close="close" />
  </div>
</template>
