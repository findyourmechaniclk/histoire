<script setup lang="ts">
import type { UiAgentRegistryEntry } from '@histoire/shared'
import { BuiltinIcon, HstPulsatingDisc, HstSwitch } from '@histoire/controls/vue'
import { computed, ref } from 'vue'
import { useAgentsStore } from '../../../stores/agents.js'
import { formatAgentCommand } from '../../../util/agent-command.js'
import { agentIconUrl } from '../../../util/agents-http.js'
import AgentLogo from '../../agents/AgentLogo.vue'
import AgentAdvancedSettings from './AgentAdvancedSettings.vue'
import AgentModelSettings from './AgentModelSettings.vue'

/** Configured ID retains credentials; unconfigured catalog entry uses canonical ID. */
const props = defineProps<{ agentId: string, registryEntry?: UiAgentRegistryEntry }>()
/** Provider owns preferences and separate HTTP catalog state. */
const agents = useAgentsStore()!
/** Optional local launch definition. */
const preset = computed(() => agents.state.value.presets.find(item => item.id === props.agentId))
/** Status only exists for configured presets. */
const status = computed(() => agents.state.value.agents.find(item => item.id === props.agentId))
/** Registry identity supplies display name before explicit configuration. */
const name = computed(() => preset.value?.name ?? props.registryEntry?.name ?? props.agentId)
/** Per-agent opt-in stays visible even when global switch is disabled. */
const enabled = computed(() => agents.state.value.enabledIds.includes(props.agentId))
/** Custom commands remain usable even when matching catalog entry lacks platform support. */
const unavailable = computed(() => (!preset.value || preset.value.registryId) && props.registryEntry?.available === false)
/** Custom commands are identified by their launch line since they have no registry logo. */
const commandLine = computed(() => preset.value && !preset.value.registryId ? formatAgentCommand(preset.value.command, preset.value.args) : undefined)
/** Off switch already conveys the idle disabled state; only show meaningful process states. */
const showStatus = computed(() => unavailable.value || (status.value && status.value.state !== 'disabled'))
/** Advanced form errors remain readable after disclosure closes. */
const advancedError = ref('')
/** Human-readable process states. */
const labels = { 'disabled': 'Disabled', 'starting': 'Starting', 'connected': 'Connected', 'idle': 'Idle', 'error': 'Error', 'not-installed': 'Not installed' }

/** Registry enablement adds only selected preset, never whole remote catalog. */
function toggle(value: boolean): void {
  if (preset.value) {
    agents.enableAgent(props.agentId, value)
  }
  else if (value && props.registryEntry?.available) {
    const entry = props.registryEntry
    agents.configure({ presets: [...agents.state.value.presets, { id: entry.id, registryId: entry.id, name: entry.name, command: entry.command, args: entry.args }], enabledIds: [...agents.state.value.enabledIds, entry.id] })
  }
}
</script>

<template>
  <article class="htw:[border-bottom:1px_solid_var(--histoire-border,_#e4e4e7)] htw:last-of-type:[border-bottom:0]" :aria-label="name" :data-agent-id="agentId">
    <div class="htw:flex htw:items-center htw:gap-[13px] htw:p-[17px_20px] htw:[@media(max-width:_600px)]:gap-[8px] htw:[@media(max-width:_600px)]:p-[14px] htw:[@media(max-width:_600px)]:flex-wrap">
      <span class="htw:w-[32px] htw:h-[32px] htw:shrink-0 htw:grid htw:place-items-center htw:text-muted htw:bg-chip htw:rounded-[10px]">
        <AgentLogo :icon="registryEntry?.icon ? agentIconUrl(registryEntry.id) : undefined" :size="20" />
      </span>
      <span class="htw:min-w-0 htw:flex-1 htw:flex htw:items-center htw:flex-wrap htw:gap-[7px]"><strong>{{ name }}</strong><span v-if="preset?.default" class="htw:p-[2px_6px] htw:rounded-[6px] htw:[background:var(--histoire-subtle,_#f4f4f5)] htw:text-muted htw:text-[10px] htw:font-semibold htw:uppercase">Default</span><code v-if="commandLine" class="htw:[flex:1_0_100%] htw:min-w-0 htw:text-muted htw:[font:11px_var(--histoire-font-mono,_monospace)] htw:whitespace-nowrap htw:overflow-hidden htw:text-ellipsis" :title="commandLine">{{ commandLine }}</code></span>
      <span v-if="showStatus" class="htw:flex htw:items-center htw:gap-[6px] htw:text-[12px] htw:whitespace-nowrap htw:text-muted htw:[&:not([data-state='starting'])]:[&::before]:[content:''] htw:[&:not([data-state='starting'])]:[&::before]:w-[7px] htw:[&:not([data-state='starting'])]:[&::before]:h-[7px] htw:[&:not([data-state='starting'])]:[&::before]:bg-current htw:[&:not([data-state='starting'])]:[&::before]:rounded-[50%] htw:[&[data-state='connected']]:text-accent-text htw:[&[data-state='error']]:text-warn htw:[&[data-state='not-installed']]:text-warn htw:[@media(max-width:_600px)]:text-[11px] htw:[@media(max-width:_600px)]:[white-space:normal] htw:[@media(max-width:_600px)]:max-w-[45%]" :data-state="status?.state ?? 'disabled'">
        <HstPulsatingDisc v-if="status?.state === 'starting'" :size="12" />
        {{ unavailable ? 'Unavailable on this platform' : labels[status?.state ?? 'disabled'] }}
      </span>
      <HstSwitch layout="inline" :model-value="enabled" :aria-label="`Enable ${name}`" :disabled="agents.pending.value || !agents.connected.value || unavailable || (!preset && agents.state.value.presets.length >= 32)" @update:model-value="toggle" />
    </div>
    <AgentModelSettings v-if="preset && enabled" :agent-id="agentId" />
    <p v-if="status?.error" role="alert" class="htw:text-warn htw:text-[12px] htw:[overflow-wrap:anywhere] htw:m-[0_20px_12px_65px] htw:[@media(max-width:_600px)]:mx-[14px]">
      {{ status.error }}
    </p>
    <p v-if="status?.warning" role="status" class="htw:m-[0_20px_12px_65px] htw:p-[8px_10px] htw:rounded-[8px] htw:text-warn htw:[background:var(--histoire-subtle)] htw:text-[12px] htw:[overflow-wrap:anywhere] htw:[@media(max-width:_600px)]:mx-[14px]">
      {{ status.warning }}
    </p>
    <p v-if="advancedError" role="alert" class="htw:text-warn htw:text-[12px] htw:[overflow-wrap:anywhere] htw:m-[0_20px_12px_65px] htw:[@media(max-width:_600px)]:mx-[14px]">
      {{ advancedError }}
    </p>
    <!-- Native open state drives the disclosure icon. -->
    <details v-if="preset" class="htw:group/agent-advanced">
      <summary class="htw:flex htw:items-center htw:justify-between htw:gap-[12px] htw:m-[0_20px_12px_65px] htw:p-[8px_10px] htw:rounded-[8px] htw:text-muted htw:cursor-pointer htw:list-none htw:text-[12px] htw:[&::-webkit-details-marker]:hidden htw:hover:[background:var(--histoire-subtle)] htw:focus-visible:[outline:2px_solid_var(--histoire-focus-ring,_currentColor)] htw:focus-visible:[outline-offset:2px] htw:[@media(max-width:_600px)]:mx-[14px]">
        {{ preset.registryId ? 'Advanced settings' : 'Configure' }}<BuiltinIcon class="htw:group-open/agent-advanced:rotate-180" icon="chevron-down" :size="16" />
      </summary>
      <AgentAdvancedSettings :agent-id="agentId" :registry-entry="registryEntry" @error="advancedError = $event" />
    </details>
  </article>
</template>
