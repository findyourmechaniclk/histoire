<script setup lang="ts">
import type { VisualCounts } from './projection.js'
import { BuiltinIcon } from '@histoire/controls/vue'
import { computed } from 'vue'
import { VISUAL_ISSUE_STATUSES } from './projection.js'
import { VISUAL_STATUS } from './status.js'

/** Run totals with explicit progress while comparisons are pending. */
const props = defineProps<{ counts: VisualCounts, running: boolean, completed: number, total: number, stale: boolean }>()
/** Only outcomes that actually occurred, so idle statuses do not crowd narrow panes. */
const issues = computed(() => VISUAL_ISSUE_STATUSES.filter(status => props.counts[status]))
const done = computed(() => props.counts.passed + issues.value.reduce((sum, status) => sum + props.counts[status], 0))
</script>

<template>
  <section class="htw:pt-0 htw:px-pane-gutter htw:pb-1" aria-label="Visual run summary">
    <div class="htw:flex htw:gap-0.5 htw:h-1.5 htw:overflow-hidden htw:rounded-[4px] htw:bg-chip" role="progressbar" :aria-label="running ? 'Visual run progress' : 'Compared images'" :aria-valuemin="0" :aria-valuemax="total" :aria-valuenow="running ? completed : done">
      <span v-if="running" class="htw:min-w-0 htw:bg-accent htw:[transition:width_.2s]" :style="{ width: `${total ? completed / total * 100 : 0}%` }" />
      <template v-else>
        <span class="htw:min-w-0 htw:bg-accent" :style="{ flexGrow: counts.passed }" />
        <span v-for="status in issues" :key="status" class="htw:min-w-0 htw:data-[tone=danger]:bg-danger htw:data-[tone=warn]:bg-warn htw:data-[tone=muted]:bg-muted" :data-tone="VISUAL_STATUS[status].tone" :style="{ flexGrow: counts[status] }" />
      </template>
    </div>
    <output v-if="running" class="htw:block htw:mt-1.5 htw:mx-0 htw:mb-0 htw:text-muted htw:text-[11px] htw:tabular-nums" role="status" aria-live="polite" aria-atomic="true">
      Comparing images…{{ total ? ` ${completed} of ${total}` : '' }}
    </output>
    <output v-else class="htw:flex htw:flex-wrap htw:gap-[6px_13px] htw:items-center htw:pt-3 htw:px-0 htw:pb-[3px] htw:tabular-nums" role="status" aria-live="polite">
      <span class="htw:inline-flex htw:items-center htw:gap-[5px] htw:font-[750] htw:whitespace-nowrap htw:data-[tone=passed]:text-accent-link htw:data-[tone=danger]:text-danger-text htw:data-[tone=warn]:text-warn htw:data-[tone=muted]:text-muted" :data-tone="counts.passed ? 'passed' : 'muted'"><BuiltinIcon icon="checkmark-filled" :size="16" />{{ counts.passed }} passed</span>
      <span v-for="status in issues" :key="status" class="htw:inline-flex htw:items-center htw:gap-[5px] htw:font-[750] htw:whitespace-nowrap htw:data-[tone=passed]:text-accent-link htw:data-[tone=danger]:text-danger-text htw:data-[tone=warn]:text-warn htw:data-[tone=muted]:text-muted" :data-tone="VISUAL_STATUS[status].tone"><BuiltinIcon :icon="VISUAL_STATUS[status].icon" :size="16" />{{ counts[status] }} {{ VISUAL_STATUS[status].label.toLowerCase() }}</span>
      <span class="htw:text-muted htw:ml-auto htw:font-medium">{{ done }}/{{ total }}</span>
    </output>
    <p v-if="stale && !running" class="htw:flex htw:items-center htw:gap-1.5 htw:mt-1.5 htw:mx-0 htw:mb-0 htw:text-warn htw:text-[11px]">
      <BuiltinIcon icon="renew" :size="14" />Source changed, run again to approve
    </p>
  </section>
</template>
