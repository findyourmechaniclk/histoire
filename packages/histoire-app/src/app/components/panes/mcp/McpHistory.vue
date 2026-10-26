<script setup lang="ts">
import { BuiltinIcon, HstSwitch } from '@histoire/controls/vue'
import { useHistoireSnapshot } from '@histoire/vue'
import { computed } from 'vue'
import { mcpOperationIcon, mcpTargetLabel, mcpTimeAgo } from '../../../stores/mcp-activity.js'
import { useMcpStore } from '../../../stores/mcp.js'
import WorkbenchVirtualList from '../../lists/WorkbenchVirtualList.vue'

const store = useMcpStore()
const snapshot = useHistoireSnapshot()
/** Exact operation IDs keep final status attached to the same recycled history row. */
const rows = computed(() => store.history.map(operation => ({ key: operation.id, operation })))
</script>

<template>
  <section class="htw:m-0" aria-label="MCP operation history">
    <header class="htw:flex htw:items-center htw:justify-between htw:gap-3 htw:mb-4.5">
      <h3 class="htw:m-0 htw:text-muted htw:text-[12px] htw:font-semibold">
        History
      </h3>
      <HstSwitch v-model="store.follow" title="Follow" aria-label="Follow MCP operations" class="htw:p-0 htw:m-0" />
    </header>
    <p v-if="!store.history.length" class="htw:m-0 htw:text-[12px] htw:text-muted">
      No tool calls yet.
    </p>
    <WorkbenchVirtualList v-else :items="rows" :min-item-size="45" list-tag="ul" item-tag="li" page-mode>
      <template #default="{ item: { operation } }">
        <div class="htw:group/history htw:flex htw:items-center htw:gap-2 htw:min-w-0 htw:py-row-mcp htw:px-0" :data-state="operation.state">
          <span class="htw:flex htw:flex-none htw:text-accent-link htw:group-data-[state=failed]/history:text-danger-text htw:group-data-[state=cancelled]/history:text-muted" :aria-label="operation.state"><BuiltinIcon :icon="mcpOperationIcon(operation)" :size="16" /></span>
          <span class="htw:grid htw:flex-1 htw:min-w-0 htw:gap-[1px]">
            <code class="htw:text-[11px] htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap" :title="operation.tool">{{ operation.tool }}</code>
            <span class="htw:text-muted htw:text-[11px] htw:wrap-anywhere">{{ mcpTargetLabel(operation.target, snapshot.catalog) || store.clientName(operation.clientId) }}{{ operation.state === 'failed' ? ' · failed' : operation.state === 'cancelled' ? ' · cancelled' : '' }}</span>
          </span>
          <time class="htw:flex-none htw:text-muted htw:font-mono htw:text-[10px]" :datetime="operation.endedAt ?? operation.startedAt" :title="operation.endedAt ?? operation.startedAt">{{ mcpTimeAgo(operation.endedAt ?? operation.startedAt, store.now) }}</time>
        </div>
      </template>
    </WorkbenchVirtualList>
  </section>
</template>
