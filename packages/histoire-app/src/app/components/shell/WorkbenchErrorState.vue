<script setup lang="ts">
import { BuiltinIcon } from '@histoire/controls/vue'
import WorkbenchStateLayout from './WorkbenchStateLayout.vue'

withDefaults(defineProps<{
  /** Offline Carbon glyph name shown in danger badge. */
  icon?: string
  /** Short headline describing operation that failed. */
  title: string
  /** Grow to fill available flex-panel space. */
  fill?: boolean
  /** Leave outer spacing to the parent layout. */
  flush?: boolean
}>(), { icon: 'error-filled' })
defineSlots<{
  /** Optional error detail beneath headline. */
  default?: () => any
  /** Optional recovery actions, such as retrying operation. */
  actions?: () => any
}>()
</script>

<template>
  <WorkbenchStateLayout :title="title" :fill="fill" :flush="flush" role="alert" atomic>
    <template #visual>
      <span class="htw:grid htw:place-items-center htw:flex-none htw:size-12 htw:mb-2 htw:rounded-full htw:text-danger-text htw:bg-danger-soft" aria-hidden="true">
        <BuiltinIcon :icon="icon" :size="22" />
      </span>
    </template>
    <template v-if="$slots.default" #default>
      <slot />
    </template>
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
  </WorkbenchStateLayout>
</template>
