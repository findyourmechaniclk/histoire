<script setup lang="ts">
import { HstButton } from '@histoire/controls/vue'

defineProps<{
  /** Histoire guide URL. */
  href: string
  /** Action text describing the guide. */
  label: string
}>()
</script>

<template>
  <HstButton as="a" color="flat" tone="accent" :href="href" target="_blank" rel="noopener noreferrer">
    {{ label }}
  </HstButton>
</template>
