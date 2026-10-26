<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'

defineProps<{
  /** Real catalog preview-story count. */
  stories: number
  /** Real documentation-only count. */
  guides: number
}>()
defineEmits<{
  /** Focus existing Search pane; this surface owns no duplicate search state. */
  search: []
}>()
</script>

<template>
  <HstButton type="button" class="htw:overflow-hidden htw:[border:1px_solid_var(--histoire-border)] htw:rounded-[14px] htw:bg-surface htw:border-border htw:text-left htw:not-disabled:[&:hover]:border-accent htw:not-disabled:[&:hover]:bg-surface htw:focus-visible:[outline-offset:3px] htw:flex htw:items-center htw:justify-start htw:gap-[12px] htw:w-full htw:p-[14px_16px] htw:text-muted htw:hover:text-text" @click="$emit('search')">
    <BuiltinIcon icon="search" :size="16" />
    <span class="htw:flex-1">Search {{ stories }} stories and {{ guides }} docs pages</span>
    <kbd class="htw:[border:1px_solid_var(--histoire-border)] htw:rounded-[5px] htw:p-[2px_5px] htw:font-mono htw:text-[10px]">Ctrl K</kbd>
  </HstButton>
</template>
