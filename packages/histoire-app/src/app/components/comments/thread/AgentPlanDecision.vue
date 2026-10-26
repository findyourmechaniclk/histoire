<script setup lang="ts">
import type { UiAgentPlanDecision } from '@histoire/shared'
import { BuiltinIcon } from '@histoire/controls/vue'
import { ref } from 'vue'
import AgentDisclosure from './AgentDisclosure.vue'
import AgentMarkdown from './AgentMarkdown.vue'

defineProps<{
  /** User answer to a plan approval card. */
  decision: UiAgentPlanDecision
}>()
/** Plan text stays collapsed until asked for. */
const open = ref(false)
</script>

<template>
  <section class="htw:min-w-0 htw:mb-1.5 htw:text-[11px] htw:text-muted htw:group/decision" aria-label="Plan decision" :data-outcome="decision.outcome">
    <AgentDisclosure :aria-expanded="decision.plan ? open : undefined" :disabled="!decision.plan" @click="open = !open">
      <BuiltinIcon v-if="decision.plan" class="htw:[transition:transform_120ms_ease-out] htw:data-[open=true]:rotate-90 htw:motion-reduce:transition-none" :data-open="open" icon="chevron-right" :size="12" />
      <BuiltinIcon icon="list-checked" :size="14" />
      <strong class="htw:text-body htw:font-semibold">Plan</strong>
      <span class="outcome htw:inline-flex htw:items-center htw:gap-1 htw:py-0 htw:px-1.5 htw:border htw:border-border htw:rounded-full htw:bg-chip htw:text-[10px] htw:font-medium htw:leading-[16px] htw:group-data-[outcome=approved]/decision:text-accent-link">
        <BuiltinIcon :icon="decision.outcome === 'approved' ? 'checkmark-filled' : 'edit'" :size="12" />
        {{ decision.outcome === 'approved' ? 'Approved' : 'Kept planning' }}
      </span>
    </AgentDisclosure>
    <AgentMarkdown v-if="open && decision.plan" class="htw:mt-0.5 htw:mx-0 htw:mb-1 htw:py-2 htw:px-2.5 htw:border htw:border-border htw:rounded-[6px]" :text="decision.plan" />
  </section>
</template>
