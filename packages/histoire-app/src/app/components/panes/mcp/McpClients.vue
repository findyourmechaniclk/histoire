<script setup lang="ts">
import { BuiltinIcon } from '@histoire/controls/vue'
import { computed } from 'vue'
import { mcpTimeAgo } from '../../../stores/mcp-activity.js'
import { useMcpStore } from '../../../stores/mcp.js'
import WorkbenchVirtualList from '../../lists/WorkbenchVirtualList.vue'

const store = useMcpStore()

/** Index running clients once so status updates never scan operations per mounted row. */
const rows = computed(() => {
  const running = new Set(store.running.filter(operation => operation.state === 'running').map(operation => operation.clientId))
  return store.clients.map(client => ({ key: client.id, client, active: running.has(client.id) }))
})
</script>

<template>
  <section class="htw:mt-0 htw:mx-0 htw:mb-5.5" aria-label="Connected MCP clients">
    <h3 class="htw:mt-0 htw:mx-0 htw:mb-3.5 htw:text-muted htw:text-[12px] htw:font-semibold">
      Clients
    </h3>
    <p v-if="!store.clients.length" class="htw:m-0 htw:text-muted htw:text-[12px]">
      No clients connected.
    </p>
    <WorkbenchVirtualList v-else :items="rows" :min-item-size="47" list-tag="ul" item-tag="li" page-mode>
      <template #default="{ item: { client, active } }">
        <div class="htw:flex htw:items-center htw:gap-2.5 htw:py-row-mcp htw:px-0">
          <span class="htw:grid htw:place-items-center htw:flex-none htw:w-7.5 htw:h-7.5 htw:rounded-[9px] htw:text-muted htw:bg-chip htw:data-[active=true]:text-agent-text htw:data-[active=true]:bg-agent-soft" :data-active="active"><BuiltinIcon icon="bot" :size="20" /></span>
          <span class="htw:grid htw:flex-1 htw:min-w-0 htw:gap-[1px]">
            <strong class="htw:text-[13px] htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap htw:font-[650]">{{ client.name }}</strong>
            <span class="htw:text-[11px] htw:text-muted">{{ client.transport }} · {{ active ? mcpTimeAgo(client.connectedAt, store.now) : `idle ${mcpTimeAgo(client.lastSeenAt, store.now)}` }}</span>
          </span>
          <span class="htw:flex-none htw:w-[7px] htw:h-[7px] htw:rounded-full htw:bg-border htw:data-[active=true]:bg-accent" :data-active="active" :aria-label="active ? 'Active' : 'Idle'" />
        </div>
      </template>
    </WorkbenchVirtualList>
  </section>
</template>
