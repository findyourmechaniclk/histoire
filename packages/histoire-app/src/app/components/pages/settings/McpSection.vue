<script setup lang="ts">
import { HstButton } from '@histoire/controls/vue'
import { computed, ref } from 'vue'
import { mcpClientConfig, mcpStdioClientConfig } from '../../../stores/mcp-activity.js'
import { useMcpStore } from '../../../stores/mcp.js'
import SettingsCard from './SettingsCard.vue'
import SettingsRow from './SettingsRow.vue'

const mcp = useMcpStore()
const copied = ref<'http' | 'stdio'>()
const httpConfig = computed(() => mcp.endpoint ? mcpClientConfig(mcp.endpoint) : undefined)
const stdioConfig = computed(() => mcp.stdio ? mcpStdioClientConfig(mcp.stdio) : undefined)
/** Copy only existing safe serializers, including stdio-only server metadata. */
async function copy(kind: 'http' | 'stdio', value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = kind
  }
  catch { copied.value = undefined }
}
</script>

<template>
  <section class="htw:w-[min(100%,_740px)] htw:mx-auto">
    <h1 class="htw:text-[25px] htw:font-bold htw:m-[0_0_22px]">
      MCP server
    </h1><SettingsCard>
      <SettingsRow>
        <strong class="htw:first:flex-1">Status</strong><span>{{ mcp.status === 'enabled' ? 'Enabled' : mcp.status === 'unavailable' ? 'Unavailable' : 'Disabled' }}</span>
      </SettingsRow><template v-if="mcp.endpoint">
        <SettingsRow>
          <strong class="htw:first:flex-1">Endpoint</strong><code>{{ mcp.endpoint }}</code>
        </SettingsRow>
      </template><template v-if="httpConfig || stdioConfig">
        <SettingsRow v-if="httpConfig">
          <strong class="htw:first:flex-1">HTTP client configuration</strong><HstButton color="default" type="button" @click="copy('http', httpConfig)">
            {{ copied === 'http' ? 'Copied' : 'Copy HTTP config' }}
          </HstButton>
        </SettingsRow><pre v-if="httpConfig" class="htw:[flex:1_0_100%] htw:overflow-auto htw:whitespace-pre-wrap htw:max-h-[200px] htw:font-mono htw:text-[11px] htw:pt-0 htw:px-5 htw:pb-5">{{ httpConfig }}</pre>
        <SettingsRow v-if="stdioConfig">
          <strong class="htw:first:flex-1">Stdio client configuration</strong><HstButton color="default" type="button" @click="copy('stdio', stdioConfig)">
            {{ copied === 'stdio' ? 'Copied' : 'Copy stdio config' }}
          </HstButton>
        </SettingsRow><pre v-if="stdioConfig" class="htw:[flex:1_0_100%] htw:overflow-auto htw:whitespace-pre-wrap htw:max-h-[200px] htw:font-mono htw:text-[11px] htw:pt-0 htw:px-5 htw:pb-5">{{ stdioConfig }}</pre>
      </template>
    </SettingsCard>
  </section>
</template>
