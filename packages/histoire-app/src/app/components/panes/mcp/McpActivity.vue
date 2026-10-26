<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { useHistoireSnapshot } from '@histoire/vue'
import { computed } from 'vue'
import { isMcpOperationCancellable, mcpOperationIcon, mcpOperationProgress, mcpTargetLabel, mcpTimeAgo } from '../../../stores/mcp-activity.js'
import { useMcpStore } from '../../../stores/mcp.js'

defineEmits<{
  /** Focus shared MCP pane without changing route or Follow preference. */
  open: []
}>()
const store = useMcpStore()
const snapshot = useHistoireSnapshot()
const current = computed(() => store.current)
const cancellable = computed(() => current.value && isMcpOperationCancellable(current.value))
const progress = computed(() => mcpOperationProgress(current.value))
const recent = computed(() => store.history.slice(0, 3))
</script>

<template>
  <section v-if="store.status === 'enabled'" aria-label="Agent activity">
    <h2 class="htw:flex htw:items-center htw:gap-2 htw:mt-0 htw:mx-0 htw:mb-3.5 htw:text-[15px] htw:font-extrabold">
      <HstButton class="htw:p-0 htw:border-0 htw:bg-transparent htw:[&:hover]:bg-transparent htw:text-inherit htw:[font-family:inherit] htw:[font-size:inherit] htw:[font-weight:inherit] htw:leading-[inherit] htw:hover:text-accent-link" color="flat" type="button" @click="$emit('open')">
        Agent activity
      </HstButton><small class="htw:text-muted htw:text-[10px] htw:rounded-[5px] htw:py-0.5 htw:px-[5px] htw:bg-chip">DEV</small>
    </h2>
    <div class="htw:p-3 htw:border htw:border-solid htw:border-border htw:rounded-[14px] htw:bg-surface">
      <div v-if="current" class="htw:p-2.5 htw:mb-2 htw:rounded-[10px] htw:bg-agent-soft" aria-live="polite">
        <div class="htw:flex htw:items-center htw:gap-2 htw:text-agent-text">
          <BuiltinIcon icon="bot" :size="16" />
          <strong class="htw:shrink-0 htw:max-w-30 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap htw:text-text htw:text-[11px] htw:font-bold" :title="store.clientName(current.clientId)">{{ store.clientName(current.clientId) }}</strong>
          <code class="htw:flex-1 htw:min-w-0 htw:text-[10px] htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap" :title="current.tool">{{ current.tool }}</code>
          <span v-if="progress" class="htw:flex-none htw:text-muted htw:font-mono htw:text-[10px]">{{ progress.done }} / {{ progress.total }}</span>
          <HstButton v-if="cancellable" class="htw:[--histoire-icon-button-size:24px] htw:text-danger-text htw:disabled:opacity-[.5] htw:disabled:[cursor:wait]" icon-only color="flat" type="button" :disabled="store.cancelling.includes(current.id)" aria-label="Cancel operation" @click="store.cancel(current.id)">
            <BuiltinIcon icon="stop-filled" :size="12" />
          </HstButton>
        </div>
        <progress v-if="progress" class="htw:appearance-none htw:block htw:w-full htw:h-1 htw:mt-2 htw:border-0 htw:rounded-full htw:bg-surface htw:overflow-hidden htw:[&::-webkit-progress-bar]:bg-surface htw:[&::-webkit-progress-bar]:rounded-full htw:[&::-webkit-progress-value]:bg-agent htw:[&::-webkit-progress-value]:rounded-full htw:[&::-moz-progress-bar]:bg-agent htw:[&::-moz-progress-bar]:rounded-full" :value="progress.done" :max="progress.total" aria-label="Operation progress" />
      </div>
      <ul v-if="recent.length" class="htw:grid htw:gap-3 htw:list-none htw:pt-1.5 htw:px-0 htw:pb-0 htw:m-0">
        <li v-for="operation in recent" :key="operation.id" class="htw:group/activity htw:flex htw:items-center htw:gap-2 htw:min-w-0" :data-state="operation.state">
          <span class="htw:flex htw:flex-none htw:text-accent-link htw:group-data-[state=failed]/activity:text-danger-text htw:group-data-[state=cancelled]/activity:text-muted" :aria-label="operation.state"><BuiltinIcon :icon="mcpOperationIcon(operation)" :size="13" /></span>
          <code class="htw:min-w-0 htw:text-[10px] htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap" :title="operation.tool">{{ operation.tool }}</code>
          <span class="htw:flex-1 htw:min-w-0 htw:text-muted htw:text-[10px] htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap htw:text-end" :title="mcpTargetLabel(operation.target, snapshot.catalog)">{{ mcpTargetLabel(operation.target, snapshot.catalog) || store.clientName(operation.clientId) }}</span>
          <time class="htw:flex-none htw:text-muted htw:font-mono htw:text-[10px]" :datetime="operation.endedAt ?? operation.startedAt">{{ mcpTimeAgo(operation.endedAt ?? operation.startedAt, store.now) }}</time>
        </li>
      </ul>
      <p v-if="!current && !recent.length" class="htw:m-1 htw:text-muted htw:text-[12px]">
        {{ store.clients.length ? `${store.clients.length} client${store.clients.length === 1 ? '' : 's'} connected.` : 'No tool calls yet.' }}
      </p>
      <p v-if="store.error" class="htw:m-1 htw:text-danger-text htw:text-[12px]" role="alert">
        {{ store.error }}
      </p>
    </div>
  </section>
</template>
