<script setup lang="ts">
defineSlots<{
  /** Related settings rows. */
  default?: () => any
}>()
</script>

<template>
  <div class="htw:[border:1px_solid_var(--histoire-border,_#e4e4e7)] htw:rounded-[15px] htw:bg-surface htw:mb-[18px] htw:overflow-hidden">
    <slot />
  </div>
</template>
