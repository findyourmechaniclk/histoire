<script setup lang="ts">
import type { UiAgentConfigSelector } from '@histoire/shared'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'

defineProps<{
  /** Group name, e.g. "Model". */
  label: string
  /** Agent-advertised choices. */
  selector: UiAgentConfigSelector
  /** Value in effect. */
  current?: string
  /** Disables every choice. */
  disabled?: boolean
}>()
const emit = defineEmits<{
  /** Picked value. */
  pick: [value: string]
}>()
</script>

<template>
  <div class="htw:flex htw:flex-col htw:gap-1">
    <span class="htw:text-muted htw:text-[11px] htw:font-semibold">{{ label }}</span>
    <div role="radiogroup" :aria-label="label" class="htw:flex htw:flex-col htw:max-h-44 htw:overflow-y-auto">
      <HstButton v-for="option in selector.options" :key="option.value" color="flat" type="button" role="radio" :aria-label="option.label" :aria-checked="option.value === current" :disabled="disabled" class="htw:flex htw:items-center htw:justify-between htw:gap-2 htw:px-2 htw:py-1.25 htw:text-body htw:text-[12px] htw:text-left htw:aria-checked:text-text htw:aria-checked:font-semibold" @click="emit('pick', option.value)">
        <span>{{ option.group ? `${option.group} / ${option.label}` : option.label }}</span><BuiltinIcon v-if="option.value === current" icon="checkmark" :size="14" />
      </HstButton>
    </div>
  </div>
</template>
