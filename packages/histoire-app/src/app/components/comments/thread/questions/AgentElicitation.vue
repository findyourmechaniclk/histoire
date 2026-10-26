<script setup lang="ts">
import type { UiAgentElicitation } from '@histoire/shared'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { useAgentsStore } from '../../../../stores/agents.js'
import ElicitationForm from './ElicitationForm.vue'
import ElicitationLink from './ElicitationLink.vue'
import { useExpiryCountdown } from './use-expiry-countdown.js'

const props = defineProps<{
  /** Pending agent input request. */
  request: UiAgentElicitation
}>()
const agents = useAgentsStore()
/** Time left, shown only shortly before the request expires. */
const countdown = useExpiryCountdown(() => props.request.expiresAt)
</script>

<template>
  <section class="htw:grid htw:gap-2.5 htw:mt-2 htw:mx-0 htw:mb-1 htw:p-2.5 htw:[border:1px_solid_var(--histoire-agent-soft,_var(--histoire-border))] htw:rounded-[10px] htw:bg-surface htw:text-[12px] htw:text-text" aria-label="Agent question">
    <header class="htw:flex htw:items-center htw:gap-1.5 htw:text-agent-text">
      <BuiltinIcon :icon="request.mode === 'url' ? 'launch' : 'help'" :size="14" />
      <strong class="htw:text-text htw:font-semibold">{{ request.mode === 'form' && request.title ? request.title : 'Input needed' }}</strong>
      <span v-if="countdown" class="htw:ml-auto htw:text-muted htw:text-[11px] htw:tabular-nums">Expires in {{ countdown }}</span>
      <HstButton color="flat" icon-only type="button" :class="countdown ? 'htw:ml-0' : 'htw:ml-auto'" class="htw:-my-1 htw:-mr-1.5 htw:text-muted" aria-label="Dismiss" title="Dismiss" @click="agents?.replyElicitation(request.requestId, 'cancel')">
        <BuiltinIcon icon="close" :size="14" />
      </HstButton>
    </header>
    <p class="htw:m-0 htw:leading-[1.5] htw:whitespace-pre-wrap htw:wrap-anywhere">
      {{ request.message }}
    </p>
    <ElicitationForm v-if="request.mode === 'form'" :request="request" />
    <ElicitationLink v-else :request="request" />
  </section>
</template>
