<script setup lang="ts">
import type { UiAgentStep } from '@histoire/shared'
import type { ActivityPhase } from './activity-phases.js'
import { BuiltinIcon, HstPulsatingDisc } from '@histoire/controls/vue'
import { computed, ref } from 'vue'
import { isStepRunning } from './activity-phases.js'
import AgentDisclosure from './AgentDisclosure.vue'

const props = defineProps<{
  /** Grouped consecutive steps. */
  phase: ActivityPhase
}>()
/** Glyph per phase family. */
const phaseIcons: Record<ActivityPhase['kind'], string> = { explore: 'search', edit: 'edit', run: 'terminal', other: 'settings' }
/** Glyph per ACP tool kind. */
const stepIcons: Record<UiAgentStep['kind'], string> = { read: 'document', search: 'search', think: 'light', fetch: 'link', edit: 'edit', delete: 'trash-can', move: 'move', execute: 'terminal', other: 'settings' }
/** User toggle; `undefined` follows the default (open while running or failed). */
const toggled = ref<boolean>()
const open = computed(() => props.phase.status === 'running' || (toggled.value ?? props.phase.status === 'failed'))
/** Thought-only phases have nothing to expand. */
const expandable = computed(() => props.phase.steps.some(step => step.kind !== 'think'))
</script>

<template>
  <div class="htw:min-w-0 htw:text-[11px] htw:text-muted" :data-status="phase.status">
    <AgentDisclosure class="phase-row" :aria-expanded="expandable ? open : undefined" :disabled="!expandable" @click="toggled = !open">
      <BuiltinIcon v-if="expandable" class="htw:[transition:transform_120ms_ease-out] htw:data-[open=true]:rotate-90 htw:motion-reduce:transition-none" :data-open="open" icon="chevron-right" :size="12" />
      <BuiltinIcon :icon="phaseIcons[phase.kind]" :size="14" />
      <strong class="htw:text-body htw:font-semibold">{{ phase.title }}</strong>
      <span v-if="phase.summary" class="summary htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap">{{ phase.summary }}</span>
      <span v-if="phase.added || phase.removed" class="counts htw:flex-none"><span class="added htw:text-accent-link">+{{ phase.added }}</span> <span class="removed htw:text-danger-text">-{{ phase.removed }}</span></span>
      <span v-if="phase.status === 'failed'" class="failed htw:text-danger-text">failed</span>
      <HstPulsatingDisc v-if="phase.status === 'running'" :size="10" />
    </AgentDisclosure>
    <ul v-if="open && expandable" class="phase-steps htw:grid htw:[grid-template-columns:minmax(0,_1fr)] htw:gap-0.5 htw:mt-0.5 htw:mx-0 htw:mb-1 htw:pt-0 htw:pr-0 htw:pb-0 htw:pl-4.5 htw:list-none">
      <li v-for="step in phase.steps" :key="step.id" :data-status="step.status" class="htw:flex htw:items-center htw:gap-1.5 htw:min-w-0">
        <BuiltinIcon :icon="stepIcons[step.kind]" :size="12" />
        <span class="htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap">{{ step.title }}</span>
        <code v-if="step.target && !step.title.includes(step.target)" class="htw:flex-[0_1_auto] htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap htw:text-[10px]">{{ step.target }}</code>
        <span v-if="step.added || step.removed" class="counts htw:flex-none"><span class="added htw:text-accent-link">+{{ step.added ?? 0 }}</span> <span class="removed htw:text-danger-text">-{{ step.removed ?? 0 }}</span></span>
        <BuiltinIcon v-if="step.status === 'failed'" class="failed htw:text-danger-text" icon="error-filled" :size="12" />
        <HstPulsatingDisc v-else-if="isStepRunning(step)" :size="8" />
      </li>
    </ul>
  </div>
</template>
