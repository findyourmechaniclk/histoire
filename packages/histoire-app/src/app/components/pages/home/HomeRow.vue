<script setup lang="ts">
import { HstButton } from '@histoire/controls/vue'

defineProps<{
  /** Secondary follow-up action within a card. */
  muted?: boolean
}>()
defineSlots<{
  /** Navigation label, detail and trailing action. */
  default?: () => any
}>()
</script>

<template>
  <HstButton class="htw:flex htw:items-center htw:gap-[10px] htw:w-full htw:p-[11px_14px] htw:border-0 htw:rounded-none htw:text-left htw:[&+&]:[border-top:1px_solid_var(--histoire-border)] htw:focus-visible:[outline-offset:-2px]" :class="muted ? 'htw:text-muted' : 'htw:text-text'">
    <slot />
  </HstButton>
</template>
