<script setup lang="ts">
import { useInspectorModel } from './model.js'

const { unseen } = useInspectorModel()
</script>

<template>
  <span v-if="unseen" class="inspector-event-count" :aria-label="`${unseen} unseen events`">{{ unseen }}</span>
</template>

<style scoped>
.inspector-event-count { color: var(--histoire-agent-text); font-size: 13px; font-variant-numeric: tabular-nums; }
</style>
