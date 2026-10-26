<script setup lang="ts">
import type { HistoireSelectionInput } from '@histoire/protocol'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { useHistoireSnapshot } from '@histoire/vue'
import { computed } from 'vue'
import { useWorkbenchTestsModel } from '../../panes/tests/model.js'
import HomeCard from './HomeCard.vue'
import HomeHeading from './HomeHeading.vue'

defineEmits<{
  /** Activate exact collected story/variant related to issue. */
  select: [target: HistoireSelectionInput]
}>()
const snapshot = useHistoireSnapshot()
const tests = useWorkbenchTestsModel()
const issues = computed(() => {
  const rows = tests?.rows.value.filter(row => !row.stale && (row.failed || row.notCollected)) ?? []
  const reported = new Set(rows.filter(row => row.notCollected).map(row => row.target.storyId))
  const reportedDiagnostics = new Set(rows.filter(row => row.key.startsWith('diagnostic:')).map(row => String(row.error)))
  const diagnostics = snapshot.value.catalog.diagnostics.filter(issue => issue.severity === 'warning' || (!reportedDiagnostics.has(issue.message) && (!issue.storyId || !reported.has(issue.storyId))))
  return [
    ...rows.map(row => ({ id: row.key, title: `${row.storyTitle}${row.variantTitle ? ` › ${row.variantTitle}` : ''}${row.notCollected ? ' failed to collect' : ' — failing tests'}`, message: row.error ? String((row.error as Error).message ?? row.error) : row.summary?.tests.filter(test => test.state === 'failed').map(test => test.fullName).join(', ') ?? '', warning: false, target: row.selectable ? row.target : undefined })),
    ...diagnostics.map((issue, index) => ({ id: `diagnostic:${index}`, title: issue.code, message: [issue.relativePath, issue.message].filter(Boolean).join(' — '), warning: issue.severity === 'warning', target: issue.storyId && snapshot.value.catalog.stories.some(story => story.id === issue.storyId) ? { storyId: issue.storyId } : undefined })),
  ]
})
</script>

<template>
  <section v-if="issues.length">
    <HomeHeading>
      Needs attention <span class="htw:text-muted htw:text-[10px]">{{ issues.length }}</span><small class="htw:text-muted htw:text-[10px] htw:p-[2px_5px] htw:rounded-[5px] htw:bg-chip">DEV</small>
    </HomeHeading>
    <HomeCard>
      <div v-for="issue in issues" :key="issue.id" class="htw:flex htw:items-center htw:gap-[12px] htw:p-[14px_16px] htw:[&+&]:[border-top:1px_solid_var(--histoire-border)]">
        <BuiltinIcon :icon="issue.warning ? 'warning-alt-filled' : 'error-filled'" :class="issue.warning ? 'htw:text-warn' : 'htw:text-danger'" :size="16" />
        <div class="htw:flex-1 htw:min-w-0">
          <strong>{{ issue.title }}</strong><p class="htw:overflow-hidden htw:m-[3px_0_0] htw:text-muted htw:[font:11px_var(--histoire-font-mono,_monospace)] htw:text-ellipsis htw:whitespace-nowrap">
            {{ issue.message }}
          </p>
        </div>
        <HstButton v-if="issue.target" class="htw:flex htw:items-center htw:gap-[6px] htw:p-[6px_9px] htw:text-text" color="flat" type="button" @click="$emit('select', issue.target)">
          <BuiltinIcon icon="launch" :size="16" />View
        </HstButton>
      </div>
    </HomeCard>
  </section>
</template>
