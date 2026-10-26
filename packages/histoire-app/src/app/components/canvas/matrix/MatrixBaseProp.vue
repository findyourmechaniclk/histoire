<script setup lang="ts">
import type { MatrixProp, MatrixValue } from '../../../util/matrix.js'
import { HstNumber, HstSelect, HstSwitch, HstText, HstTextarea } from '@histoire/controls/vue'
import { computed, ref } from 'vue'
import { equalMatrixValue, formatMatrixValue } from '../../../util/matrix-values.js'

const props = defineProps<{
  /** Discovered editor label and runtime type. */
  prop: MatrixProp
  /** Shared current override value. */
  value: unknown
  /** Optional finite domain for non-axis enum editor. */
  values?: readonly MatrixValue[]
  /** Mark override differing from canonical/default value. */
  edited?: boolean
}>()
const emit = defineEmits<{ update: [value: unknown] }>()
const error = ref('')
/** Select must use current domain instance after persisted object values are cloned. */
const selected = computed(() => props.values?.find((value) => {
  try {
    return equalMatrixValue(value, props.value as MatrixValue)
  }
  catch { return false }
}) ?? props.value)
const text = computed(() => {
  if (typeof props.value === 'string') return props.value
  try {
    return JSON.stringify(props.value, null, 2) ?? ''
  }
  catch { return '' }
})

/** Structured values accept JSON only; input never evaluates JavaScript. */
function structured(value: string): void {
  try {
    emit('update', JSON.parse(value))
    error.value = ''
  }
  catch { error.value = 'Enter valid JSON' }
}

/** Number edits reject unfinished/non-finite values without changing previews. */
function number(value: number): void {
  if (Number.isFinite(value)) emit('update', value)
}
</script>

<template>
  <div class="histoire-matrix-base-prop htw:flex htw:flex-col htw:gap-2 htw:mb-4" :data-edited="edited">
    <span class="htw:flex htw:items-center htw:justify-between htw:gap-2 htw:text-muted htw:font-mono htw:text-[13px]"><code class="htw:text-text htw:text-[13px]">{{ prop.name }}<small v-if="edited" class="htw:text-accent-link htw:text-[13px]"> · edited</small></code><span>{{ prop.type }}</span></span>
    <HstSelect v-if="values?.length" layout="inline" :aria-label="prop.name" :model-value="selected" :options="values.map(option => ({ value: option, label: formatMatrixValue(option) }))" @update:model-value="emit('update', $event)" />
    <HstSwitch v-else-if="prop.type === 'boolean' || typeof value === 'boolean'" layout="inline" :aria-label="prop.name" :model-value="Boolean(value)" @update:model-value="emit('update', $event)" />
    <HstNumber v-else-if="prop.type === 'number' || typeof value === 'number'" layout="inline" :aria-label="prop.name" :model-value="value as number" @update:model-value="number" />
    <HstText v-else-if="prop.type === 'string' || typeof value === 'string' || value === undefined" layout="inline" :aria-label="prop.name" type="text" :model-value="String(value ?? '')" @update:model-value="emit('update', $event)" />
    <HstTextarea v-else layout="inline" :aria-label="prop.name" :model-value="text" rows="3" @update:model-value="structured" />
    <span v-if="error" class="htw:text-danger htw:text-[13px]" role="alert">{{ error }}</span>
  </div>
</template>
