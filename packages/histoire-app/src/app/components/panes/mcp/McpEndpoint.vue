<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'
import { mcpClientConfig, mcpStdioClientConfig } from '../../../stores/mcp-activity.js'
import { useMcpStore } from '../../../stores/mcp.js'

const store = useMcpStore()
const { copy, copied } = useClipboard({ legacy: true })
const copyKind = ref<'endpoint' | 'http' | 'stdio'>('endpoint')
const copyError = ref(false)
const config = computed(() => store.endpoint ? mcpClientConfig(store.endpoint) : undefined)
const stdioConfig = computed(() => store.stdio ? mcpStdioClientConfig(store.stdio) : undefined)

/** Clipboard failure remains visible and does not claim a successful copy. */
async function copyValue(kind: 'endpoint' | 'http' | 'stdio') {
  const value = { endpoint: store.endpoint, http: config.value, stdio: stdioConfig.value }[kind]
  if (!value) return
  copyKind.value = kind
  copyError.value = false
  try {
    await copy(value)
  }
  catch {
    copyError.value = true
  }
}
</script>

<template>
  <section class="htw:p-3 htw:rounded-[12px] htw:bg-chip htw:mb-5" aria-label="MCP endpoint">
    <h3 class="htw:mt-0 htw:mx-0 htw:mb-2 htw:text-muted htw:text-[12px] htw:font-semibold">
      {{ store.endpoint ? 'Endpoint' : 'Client config' }}
    </h3>
    <div v-if="store.endpoint" class="htw:flex htw:items-center htw:gap-2.5">
      <code class="htw:flex-1 htw:min-w-0 htw:wrap-anywhere htw:text-[11px] htw:leading-[1.6]" :title="store.endpoint">{{ store.endpoint }}</code>
      <HstButton class="htw:[--histoire-icon-button-size:28px] htw:text-muted htw:hover:text-text" icon-only color="flat" type="button" :aria-label="copied && copyKind === 'endpoint' ? 'Endpoint copied' : 'Copy endpoint'" @click="copyValue('endpoint')">
        <BuiltinIcon :icon="copied && copyKind === 'endpoint' ? 'checkmark' : 'copy'" :size="16" />
      </HstButton>
    </div>
    <nav class="htw:flex htw:flex-wrap htw:gap-3" aria-label="Copy MCP client configuration">
      <HstButton v-if="config" color="flat" type="button" class="htw:[--histoire-icon-button-size:28px] htw:text-accent-link htw:inline-flex htw:w-auto htw:h-auto htw:mt-2 htw:p-0 htw:bg-transparent htw:text-[11px] htw:hover:text-text" @click="copyValue('http')">
        {{ copied && copyKind === 'http' ? 'HTTP config copied' : 'Copy HTTP config' }}
      </HstButton>
      <HstButton v-if="stdioConfig" color="flat" type="button" class="htw:[--histoire-icon-button-size:28px] htw:text-accent-link htw:inline-flex htw:w-auto htw:h-auto htw:mt-2 htw:p-0 htw:bg-transparent htw:text-[11px] htw:hover:text-text" @click="copyValue('stdio')">
        {{ copied && copyKind === 'stdio' ? 'Stdio config copied' : 'Copy stdio config' }}
      </HstButton>
    </nav>
    <span v-if="copyError" class="htw:block htw:mt-2 htw:text-[11px] htw:text-danger-text" role="alert">Copy unavailable.</span>
  </section>
</template>
