<script setup lang="ts">
import { useMcpStore } from '../../../stores/mcp.js'
import WorkbenchErrorState from '../../shell/WorkbenchErrorState.vue'
import McpClients from './McpClients.vue'
import McpCurrentOperation from './McpCurrentOperation.vue'
import McpEndpoint from './McpEndpoint.vue'
import McpHistory from './McpHistory.vue'

const store = useMcpStore()
</script>

<template>
  <section class="htw:flex-1 htw:box-border htw:pt-1 htw:px-pane-gutter htw:pb-4 htw:overflow-auto htw:min-h-0 htw:text-text" aria-label="MCP activity">
    <header class="htw:flex htw:mt-0 htw:mx-0 htw:mb-4.5">
      <span class="htw:flex htw:items-center htw:gap-[5px] htw:py-1 htw:px-2 htw:rounded-full htw:text-muted htw:bg-chip htw:text-[11px] htw:font-bold htw:data-[status=enabled]:text-accent-link htw:data-[status=enabled]:bg-accent-soft" :data-status="store.status">
        <span class="htw:w-1.5 htw:h-1.5 htw:[background:currentColor] htw:rounded-full" aria-hidden="true" />
        {{ store.status === 'enabled' ? 'Running' : store.status === 'disabled' ? 'Disabled' : 'Unavailable' }}
      </span>
    </header>
    <template v-if="store.status === 'enabled'">
      <McpEndpoint v-if="store.endpoint || store.stdio" />
      <McpClients />
      <McpCurrentOperation v-if="store.current" />
    </template>
    <WorkbenchErrorState v-else-if="store.status === 'unavailable'" title="MCP unavailable">
      <template v-if="store.error" #default>
        {{ store.error }}
      </template>
    </WorkbenchErrorState>
    <p v-else class="htw:my-6 htw:mx-0 htw:text-muted htw:text-[12px]" role="status">
      MCP disabled in project config.
    </p>
    <p v-if="store.error && store.status !== 'unavailable'" class="htw:my-3 htw:mx-0 htw:text-danger-text htw:text-[12px]" role="alert">
      {{ store.error }}
    </p>
    <p v-if="store.omitted?.reads" class="htw:my-6 htw:mx-0 htw:text-muted htw:text-[12px]" role="status">
      {{ store.omitted.reads }} reads running without activity rows.
    </p>
    <p v-if="store.omitted?.configuration" class="htw:my-6 htw:mx-0 htw:text-muted htw:text-[12px]" role="status">
      Stdio config exceeds activity channel limit.
    </p>
    <McpHistory />
  </section>
</template>
