<script setup lang="ts">
import { HstPulsatingDisc } from '@histoire/controls/vue'
import WorkbenchStateLayout from './WorkbenchStateLayout.vue'

defineProps<{
  /** Short headline describing operation in progress. */
  title: string
  /** Grow to fill available flex-panel space. */
  fill?: boolean
  /** Leave outer spacing to the parent layout. */
  flush?: boolean
}>()
defineSlots<{
  /** Optional detail beneath loading headline. */
  default?: () => any
}>()
</script>

<template>
  <WorkbenchStateLayout :title="title" :fill="fill" :flush="flush" role="status" atomic>
    <template #visual>
      <div class="htw:grid htw:place-items-center htw:flex-none htw:size-12 htw:mb-2 htw:text-accent" aria-hidden="true">
        <HstPulsatingDisc :size="32" />
      </div>
    </template>
    <template v-if="$slots.default" #default>
      <slot />
    </template>
  </WorkbenchStateLayout>
</template>
