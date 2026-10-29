<script setup lang="ts">
import { BuiltinIcon } from '@histoire/controls/vue'
import { getHistoireIcon } from '@histoire/shared/dist/icons/index.js'
import { computed, ref, watch } from 'vue'

const props = defineProps<{ logoUrl?: string, icon?: string }>()
const failed = ref(false)
watch(() => props.logoUrl, () => {
  failed.value = false
})
/** Broken logos use the puzzle glyph instead of attempting an alternative remote source. */
const fallback = computed(() => failed.value ? 'puzzle' : props.icon && getHistoireIcon(props.icon) ? props.icon : 'puzzle')
</script>

<template>
  <img v-if="logoUrl && !failed" :src="logoUrl" alt="" class="htw:size-8 htw:object-contain" @error="failed = true">
  <BuiltinIcon v-else :icon="fallback" :size="32" aria-hidden="true" />
</template>
