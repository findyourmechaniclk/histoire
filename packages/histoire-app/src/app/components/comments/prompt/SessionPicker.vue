<script setup lang="ts">
import type { UiAgentConfigOptions, UiCommentAgent, UiCommentSessionOptions } from '@histoire/shared'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { computed } from 'vue'
import AgentLogo from '../../agents/AgentLogo.vue'
import { useMenuTrigger } from './menu-trigger.js'
import { sessionLabel } from './session-labels.js'
import SessionPopover from './SessionPopover.vue'
import SessionSettings from './SessionSettings.vue'

const props = defineProps<{
  /** Usable agents offered by "Switch agent". */
  agents: readonly UiCommentAgent[]
  /** Current destination agent. */
  agentId: string
  /** Destination is bound to the conversation; it cannot be switched. */
  locked?: boolean
  /** Discovered selectors of the current agent. */
  config?: UiAgentConfigOptions
  /** Selectors are still being discovered. */
  loading?: boolean
  /** Explicit choices for this conversation. */
  options?: UiCommentSessionOptions
  /** Disables the chip. */
  disabled?: boolean
}>()
const emit = defineEmits<{
  /** Explicit agent pick. */
  'choose': [id: string]
  'update:options': [value: UiCommentSessionOptions]
}>()
const { open, trigger, anchor, toggle, close } = useMenuTrigger()
const agent = computed(() => props.agents.find(agent => agent.id === props.agentId))
/** Model name (or agent name before discovery), then the effort in effect. */
const label = computed(() => {
  const model = sessionLabel(props.config?.model, props.options?.model) ?? agent.value?.name ?? 'Choose agent'
  const effort = sessionLabel(props.config?.effort, props.options?.effort)
  return effort ? `${model} · ${effort}` : model
})
</script>

<template>
  <HstButton ref="trigger" color="flat" type="button" class="htw:inline-flex htw:items-center htw:gap-1.5 htw:min-w-0 htw:max-w-50 htw:py-1 htw:px-2 htw:text-body htw:text-[12px]" aria-haspopup="dialog" :aria-expanded="open" :title="`${agent?.name ?? agentId}: ${label}`" :disabled="disabled" @click="toggle">
    <span class="htw:flex htw:flex-none htw:text-agent"><AgentLogo :icon="agent?.icon" :size="14" /></span><span class="htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap">{{ label }}</span><BuiltinIcon icon="chevron-down" :size="12" class="htw:flex-none htw:text-muted" />
  </HstButton>
  <SessionPopover v-if="open" :anchor="anchor" @close="close">
    <SessionSettings :agents="agents" :agent-id="agentId" :locked="locked" :config="config" :loading="loading" :options="options" :disabled="disabled" @choose="emit('choose', $event)" @update:options="emit('update:options', $event)" />
  </SessionPopover>
</template>
