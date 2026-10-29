<script setup lang="ts">
import type { FrameScopedContext } from '@histoire/plugin-kit'
import type { AuditModel, AuditState } from './model.js'
import { HstButton, HstPulsatingDisc, HstSelect, HstSwitch } from '@histoire/controls/vue'
import { WorkbenchEmptyState, WorkbenchErrorState, WorkbenchLoadingState, WorkbenchPaneHeader, WorkbenchPanelAction, WorkbenchPaneList, WorkbenchPaneToolbar } from '@histoire/plugin-kit/vue'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { IMPACTS } from '../scanner/policy.js'
import FindingRow from './FindingRow.vue'

const props = defineProps<{
  /** Current actor scope supplied by host. */
  context: FrameScopedContext
  /** Host-isolated audit model. */
  model: AuditModel
}>()
const state = shallowRef<AuditState>()
const revision = ref(0)
let stop: (() => void) | undefined
watch(() => props.context.frame.key, (key) => {
  stop?.()
  stop = props.model.watch(key, () => {
    state.value = props.model.get(key)
    revision.value++
  })
}, { immediate: true })
onScopeDispose(() => stop?.())

const autoRun = computed({
  get: () => {
    void revision.value
    return props.model.autoRun()
  },
  set: value => props.model.preferences.set('autoRun', value),
})
const outcome = computed({
  get: () => {
    void revision.value
    return props.model.preferences.get<string>('outcome', 'violations') === 'incomplete' ? 'incomplete' : 'violations'
  },
  set: value => props.model.preferences.set('outcome', value),
})
const severity = computed({
  get: () => {
    void revision.value
    const value = props.model.preferences.get<string>('severity', 'all')
    return value === 'all' || value === 'unknown' || Object.hasOwn(IMPACTS, value) ? value : 'all'
  },
  set: value => props.model.preferences.set('severity', value),
})
const findings = computed(() => [...state.value?.report?.[outcome.value] ?? []]
  .filter(rule => severity.value === 'all' || (rule.impact ?? 'unknown') === severity.value)
  .sort((a, b) => (IMPACTS[b.impact!] ?? 0) - (IMPACTS[a.impact!] ?? 0) || a.id.localeCompare(b.id)))

/** Start manual scan without changing live-audit preference. */
function run(): void {
  props.model.run(props.context.frame.key)
}
</script>

<template>
  <section class="histoire-a11y" aria-label="Accessibility audit">
    <WorkbenchPaneHeader title="Accessibility">
      <label class="histoire-a11y-auto"><HstSwitch v-model="autoRun" layout="inline" aria-label="Auto-run" />Auto-run</label>
      <WorkbenchPanelAction icon="play-filled-alt" label="Run" :disabled="!state || state.running" @click="run" />
    </WorkbenchPaneHeader>
    <WorkbenchEmptyState v-if="!state" icon="list-checked" title="No variant available" />
    <WorkbenchLoadingState v-else-if="state.running && !state.report" title="Checking accessibility" />
    <WorkbenchErrorState v-else-if="state.error && !state.report" title="Accessibility check failed">
      {{ state.error }}
      <template #actions>
        <HstButton @click="run">
          Try again
        </HstButton>
      </template>
    </WorkbenchErrorState>
    <WorkbenchEmptyState v-else-if="!state.report" icon="list-checked" title="Ready to check">
      <template #actions>
        <HstButton @click="run">
          Run checks
        </HstButton>
      </template>
    </WorkbenchEmptyState>
    <template v-else>
      <div class="histoire-a11y-summary" role="status" aria-live="polite">
        <HstPulsatingDisc v-if="state.running" :size="12" />
        <strong>{{ state.report.violationsCount }} {{ state.report.violationsCount === 1 ? 'violation' : 'violations' }}</strong>
        <span>{{ state.report.incompleteCount }} need review</span>
        <span>{{ state.report.passesCount }} passed · {{ state.report.inapplicableCount }} inapplicable</span>
        <span v-if="state.stale">{{ state.running ? 'Checking' : 'Results may be outdated' }}</span>
      </div>
      <WorkbenchErrorState v-if="state.error" title="Accessibility check failed">
        {{ state.error }}
        <template #actions>
          <HstButton @click="run">
            Try again
          </HstButton>
        </template>
      </WorkbenchErrorState>
      <WorkbenchPaneToolbar>
        <div class="histoire-a11y-filters">
          <HstSelect v-model="outcome" class="histoire-a11y-filter" title="Results" :options="{ violations: 'Violations', incomplete: 'Needs review' }" />
          <HstSelect v-model="severity" class="histoire-a11y-filter" title="Severity" :options="{ all: 'All severities', critical: 'Critical', serious: 'Serious', moderate: 'Moderate', minor: 'Minor', unknown: 'Unknown' }" />
        </div>
      </WorkbenchPaneToolbar>
      <WorkbenchEmptyState v-if="!findings.length" icon="checkmark" :title="!state.report.violationsCount && outcome === 'violations' && !state.report.truncated ? 'No violations found' : outcome === 'incomplete' && !state.report.incompleteCount && !state.report.truncated ? 'No checks need review' : 'No matching findings'">
        <template v-if="state.report.incompleteCount && !state.report.violationsCount">
          {{ state.report.incompleteCount }} rules need manual review
        </template>
      </WorkbenchEmptyState>
      <WorkbenchPaneList v-else>
        <FindingRow v-for="rule in findings" :key="`${outcome}:${rule.id}`" :rule="rule" :outcome="outcome" @highlight="model.highlight(context.frame.key, $event)" />
      </WorkbenchPaneList>
      <p v-if="state.report.droppedCount" class="histoire-a11y-note" role="status">
        {{ state.report.droppedCount }} result details omitted
      </p>
      <p v-if="state.feedback" class="histoire-a11y-note" role="status">
        {{ state.feedback }}
      </p>
    </template>
  </section>
</template>
