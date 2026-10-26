<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  /** Element or control rendered without an extra layout wrapper. */
  as?: string | Component
}>()
defineSlots<{
  /** Floating viewer controls or contextual actions. */
  default?: () => any
}>()
</script>

<template>
  <!-- Keep float background stable over the native button hover rule. -->
  <component :is="as ?? 'div'" class="htw:[background:var(--viewer-float-background,_rgb(var(--histoire-surface-rgb)_/_88%))] htw:[&:hover]:[background:var(--viewer-float-background,_rgb(var(--histoire-surface-rgb)_/_88%))] htw:border htw:border-solid htw:border-border htw:rounded-[12px] htw:shadow-popover htw:backdrop-blur-[10px]">
    <slot />
  </component>
</template>
