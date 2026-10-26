<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { useHistoireSnapshot } from '@histoire/vue'
import { computed } from 'vue'
import { isMcpOperationCancellable, mcpOperationProgress, mcpTargetLabel } from '../../../stores/mcp-activity.js'
import { useMcpStore } from '../../../stores/mcp.js'

const store = useMcpStore()
const snapshot = useHistoireSnapshot()
const operation = computed(() => store.current)
const progress = computed(() => mcpOperationProgress(operation.value))
const cancelling = computed(() => operation.value && store.cancelling.includes(operation.value.id))
</script>

<template>
  <section v-if="operation" class="htw:mb-4 htw:p-3 htw:rounded-[12px] htw:bg-agent-soft" aria-label="Current MCP operation" aria-live="polite">
    <div class="htw:flex htw:items-center htw:gap-[7px] htw:text-agent-text">
      <BuiltinIcon icon="time" :size="16" />
      <code class="htw:text-[11px] htw:wrap-anywhere">{{ operation.tool }}</code>
      <span class="htw:flex-1 htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap htw:text-[11px] htw:text-muted" :title="mcpTargetLabel(operation.target, snapshot.catalog)">{{ mcpTargetLabel(operation.target, snapshot.catalog) }}</span>
      <HstButton v-if="isMcpOperationCancellable(operation)" class="htw:[--histoire-icon-button-size:26px] htw:text-danger-text htw:hover:bg-danger-soft htw:disabled:opacity-[.5] htw:disabled:[cursor:wait]" icon-only color="flat" type="button" :disabled="cancelling" :aria-label="cancelling ? 'Cancelling operation' : 'Cancel operation'" @click="store.cancel(operation.id)">
        <BuiltinIcon icon="stop-filled" :size="14" />
      </HstButton>
    </div>
    <progress v-if="progress" class="htw:appearance-none htw:block htw:w-full htw:h-1 htw:my-2.5 htw:mx-0 htw:border-0 htw:rounded-full htw:bg-surface htw:overflow-hidden htw:[&::-webkit-progress-bar]:bg-surface htw:[&::-webkit-progress-bar]:rounded-full htw:[&::-webkit-progress-value]:bg-agent htw:[&::-webkit-progress-value]:rounded-full htw:[&::-moz-progress-bar]:bg-agent htw:[&::-moz-progress-bar]:rounded-full" :value="progress.done" :max="progress.total" aria-label="Operation progress" />
    <div class="htw:mt-2 htw:text-muted htw:text-[11px]">
      <span v-if="cancelling">Cancelling · </span>
      <span v-else-if="progress">{{ progress.done }} of {{ progress.total }} · </span>
      <span v-else>{{ operation.state === 'queued' ? 'Queued' : 'Running' }} · </span>
      {{ store.clientName(operation.clientId) }}
    </div>
  </section>
</template>
