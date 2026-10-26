<script setup lang="ts">
import type { WorkbenchTestsSummary } from './types.js'
import { BuiltinIcon } from '@histoire/controls/vue'
import { computed } from 'vue'

/** Current assertion totals and explicit batch progress. */
const props = defineProps<{ summary: WorkbenchTestsSummary, running: boolean, completed: number, total: number }>()
const count = computed(() => props.summary.passed + props.summary.failed + props.summary.skipped)
const duration = computed(() => `${(props.summary.duration / 1000).toFixed(1)}s`)
</script>

<template>
  <section class="htw:py-0 htw:px-pane-gutter" aria-label="Project test summary">
    <div class="htw:flex htw:gap-0.5 htw:h-1.5 htw:overflow-hidden htw:rounded-[4px] htw:bg-chip" role="progressbar" :aria-label="running ? 'Test run progress' : 'Completed tests'" :aria-valuemin="0" :aria-valuemax="running ? total : count" :aria-valuenow="running ? completed : count">
      <template v-if="count">
        <span class="htw:min-w-0 htw:bg-accent" :style="{ flexGrow: summary.passed }" />
        <span class="htw:min-w-0 htw:bg-danger" :style="{ flexGrow: summary.failed }" />
        <span class="htw:min-w-0 htw:bg-chip" :style="{ flexGrow: summary.skipped }" />
      </template>
      <span v-else class="htw:min-w-0" />
    </div>
    <output class="htw:flex htw:gap-[13px] htw:items-center htw:pt-3 htw:px-0 htw:pb-[3px] htw:tabular-nums" aria-live="polite">
      <span class="htw:inline-flex htw:items-center htw:gap-[5px] htw:font-[750] htw:text-accent-link" :aria-label="`${summary.passed} passed`"><BuiltinIcon icon="checkmark-filled" :size="16" />{{ summary.passed }}</span>
      <span class="htw:inline-flex htw:items-center htw:gap-[5px] htw:font-[750] htw:text-danger-text" :aria-label="`${summary.failed} failed`"><BuiltinIcon icon="error-filled" :size="16" />{{ summary.failed }}</span>
      <span class="htw:inline-flex htw:items-center htw:gap-[5px] htw:font-[750] htw:text-muted" :aria-label="`${summary.skipped} skipped`"><BuiltinIcon icon="subtract" :size="16" />{{ summary.skipped }}</span>
      <span class="htw:inline-flex htw:items-center htw:gap-[5px] htw:font-medium htw:text-muted htw:ml-auto">{{ running ? `${completed}/${total}` : duration }}</span>
    </output>
    <p v-if="summary.stale || summary.notCollected" class="htw:flex htw:gap-3 htw:mt-1.5 htw:mx-0 htw:mb-0 htw:text-muted htw:text-[11px]">
      <span v-if="summary.stale">{{ summary.stale }} outdated</span>
      <span v-if="summary.notCollected">{{ summary.notCollected }} not collected</span>
    </p>
  </section>
</template>
