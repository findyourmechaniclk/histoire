<script setup lang="ts">
import BuiltinIcon from '../BuiltinIcon.vue'

defineOptions({ name: 'HstSimpleCheckbox' })
defineProps<{
  /** Current check presentation. */
  modelValue?: boolean
}>()
</script>

<template>
  <span class="histoire-simple-checkbox" :data-checked="Boolean(modelValue)" aria-hidden="true"><BuiltinIcon v-if="modelValue" icon="carbon:checkmark" :width="12" :height="12" /></span>
</template>
