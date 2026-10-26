<script setup lang="ts">
import { useInspectorModel } from './model.js'

const { unseen } = useInspectorModel()
</script>

<template>
  <span v-if="unseen" class="htw:text-agent-text htw:text-[13px] htw:tabular-nums" :aria-label="`${unseen} unseen events`">{{ unseen }}</span>
</template>
