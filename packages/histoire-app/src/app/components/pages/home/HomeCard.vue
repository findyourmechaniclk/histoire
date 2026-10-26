<script setup lang="ts">
defineSlots<{
  /** Related home sections or navigable rows. */
  default?: () => any
}>()
</script>

<template>
  <div class="htw:overflow-hidden htw:[border:1px_solid_var(--histoire-border)] htw:rounded-[14px] htw:bg-surface">
    <slot />
  </div>
</template>
