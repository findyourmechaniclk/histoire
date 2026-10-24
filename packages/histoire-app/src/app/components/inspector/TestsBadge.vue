<script setup lang="ts">
import { BuiltinIcon, HstPulsatingDisc } from '@histoire/controls/vue'
import { useInspectorModel } from './model.js'

const { status, count } = useInspectorModel().tests
</script>

<template>
  <span v-if="status !== 'idle'" :class="`inspector-test-${status}`" role="img" :aria-label="`Tests ${status}`">
    <HstPulsatingDisc v-if="status === 'running'" :size="12" />
    <BuiltinIcon v-else :icon="status === 'passed' ? 'checkmark' : 'close'" :size="12" />
  </span>
  <span v-else-if="count" class="inspector-test-count" :aria-label="`${count} collected tests`">{{ count }}</span>
</template>

<style scoped>
.inspector-test-running { color: var(--histoire-muted); }
.inspector-test-passed { color: var(--histoire-accent); }
.inspector-test-failed { color: var(--histoire-danger); }
.inspector-test-count { color: var(--histoire-muted); font-size: 13px; }
</style>
