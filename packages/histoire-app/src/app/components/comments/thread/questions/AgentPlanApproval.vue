<script setup lang="ts">
import type { UiAgentPermission } from '@histoire/shared'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { useAgentsStore } from '../../../../stores/agents.js'
import AgentMarkdown from '../AgentMarkdown.vue'
import QuestionActions from './QuestionActions.vue'

defineProps<{
  /** Pending plan-mode exit request. */
  request: UiAgentPermission
}>()
const agents = useAgentsStore()
</script>

<template>
  <section class="htw:grid htw:gap-2.5 htw:mt-2 htw:mx-0 htw:mb-1 htw:p-2.5 htw:[border:1px_solid_var(--histoire-agent-soft,_var(--histoire-border))] htw:rounded-[10px] htw:bg-surface htw:text-[12px] htw:text-text" aria-label="Plan approval">
    <header class="htw:flex htw:items-center htw:gap-1.5 htw:text-agent-text">
      <BuiltinIcon icon="list-checked" :size="14" />
      <strong class="htw:text-text htw:font-semibold">{{ request.detail.split('\n')[0] || 'Approve plan' }}</strong>
    </header>
    <div class="htw:max-h-65 htw:overflow-auto htw:py-2 htw:px-2.5 htw:rounded-[8px] htw:bg-chip">
      <AgentMarkdown :text="request.plan ?? 'The agent wants to start working.'" />
    </div>
    <QuestionActions>
      <HstButton
        v-for="choice in request.choices ?? []"
        :key="choice.id"
        :color="choice.intent === 'approve' ? 'primary' : 'flat'"
        type="button"
        @click="agents?.reply(request.requestId, choice.intent === 'approve', false, choice.id)"
      >
        {{ choice.label }}
      </HstButton>
    </QuestionActions>
  </section>
</template>
