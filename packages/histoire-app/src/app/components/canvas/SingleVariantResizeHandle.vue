<script setup lang="ts">
defineProps<{
  /** Keep the corner visible while edge grips remain invisible until interaction. */
  corner?: boolean
}>()
</script>

<template>
  <!-- Pointer hit areas and their edge marks share keyboard and drag feedback. -->
  <div class="htw:absolute htw:pointer-events-auto htw:touch-none htw:select-none htw:outline-none htw:hover:text-accent htw:group-data-[keyboard-input=true]/handles:focus-visible:text-accent htw:group-data-[active=true]/handles:text-accent htw:after:content-[''] htw:after:absolute htw:after:rounded-[1px]" :class="corner ? 'htw:text-muted/40' : 'htw:text-transparent'" />
</template>
