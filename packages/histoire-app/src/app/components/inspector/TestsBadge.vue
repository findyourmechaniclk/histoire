<script setup lang="ts">
import { BuiltinIcon, HstPulsatingDisc } from '@histoire/controls/vue'
import { useInspectorModel } from './model.js'

const { status, count } = useInspectorModel().tests
</script>

<template>
  <span v-if="status !== 'idle'" :class="{ idle: '', running: 'htw:text-muted', passed: 'htw:text-accent', failed: 'htw:text-danger' }[status]" role="img" :aria-label="`Tests ${status}`">
    <HstPulsatingDisc v-if="status === 'running'" :size="12" />
    <BuiltinIcon v-else :icon="status === 'passed' ? 'checkmark' : 'close'" :size="12" />
  </span>
  <span v-else-if="count" class="htw:text-muted htw:text-[13px]" :aria-label="`${count} collected tests`">{{ count }}</span>
</template>
