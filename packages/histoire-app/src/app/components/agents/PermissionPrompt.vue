<script setup lang="ts">
import { BuiltinIcon, getControlElement, HstButton } from '@histoire/controls/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAgentsStore } from '../../stores/agents.js'
import { useAiThreads } from '../../stores/ai-threads.js'
import AgentElicitation from '../comments/thread/questions/AgentElicitation.vue'
import AgentPlanApproval from '../comments/thread/questions/AgentPlanApproval.vue'

/** Provider owns permission authority; static/embedded surfaces omit it. */
const agents = useAgentsStore()
/** Opens a question's thread where it lives. */
const threads = useAiThreads()
/** Only the oldest live tool request receives keyboard focus. */
const request = computed(() => agents?.tools.value[0])
/** Oldest plan approval or input request whose thread is not on screen. */
const question = computed(() => {
  const offscreen = agents?.offscreen.value
  return offscreen?.plans[0] ?? offscreen?.elicitations[0]
})
/** Agent display name of the floating question. */
const questionAgent = computed(() => agents?.state.value.presets.find(agent => agent.id === question.value?.agentId)?.name ?? 'Agent')
/** Safe display name from current public presets. */
const name = computed(() => agents?.state.value.presets.find(agent => agent.id === request.value?.agentId)?.name ?? 'Agent')
/** Denial is the initial keyboard action for each incoming request. */
const deny = ref<HTMLButtonElement>()
/** Restores the user's workbench focus once pending requests finish. */
let previousFocus: HTMLElement | undefined
/** Restores only a still-connected element after card teardown. */
function restoreFocus(): void {
  previousFocus?.isConnected && previousFocus.focus()
  previousFocus = undefined
}
watch(() => request.value?.requestId, (id) => {
  if (!id) {
    restoreFocus()
    return
  }
  if (typeof document !== 'undefined' && !previousFocus) previousFocus = document.activeElement as HTMLElement
  deny.value?.focus()
}, { flush: 'post' })
onBeforeUnmount(restoreFocus)
</script>

<template>
  <section v-if="request" class="htw:absolute htw:end-6 htw:bottom-6 htw:z-60 htw:w-[min(440px,calc(100%-32px))] htw:p-[18px] htw:rounded-[14px] htw:bg-surface htw:text-text htw:shadow-panel" role="alertdialog" aria-labelledby="histoire-agent-permission-title" aria-describedby="histoire-agent-permission-detail" @keydown.esc.prevent="agents?.reply(request.requestId, false)">
    <h2 id="histoire-agent-permission-title" class="htw:flex htw:items-center htw:gap-2 htw:mt-0 htw:mx-0 htw:mb-3 htw:text-[14px] htw:font-semibold">
      <BuiltinIcon icon="bot" :size="18" />{{ name }} requests permission
    </h2>
    <pre id="histoire-agent-permission-detail" class="htw:max-h-[180px] htw:overflow-auto htw:p-3 htw:mt-0 htw:mx-0 htw:mb-3.5 htw:rounded-[8px] htw:bg-input htw:font-mono htw:text-[12px] htw:leading-normal htw:whitespace-pre-wrap htw:[overflow-wrap:anywhere]">{{ request.detail }}</pre>
    <div class="htw:flex htw:flex-wrap htw:justify-end htw:gap-2">
      <HstButton :ref="value => { deny = getControlElement(value) as HTMLButtonElement }" color="flat" type="button" @click="agents?.reply(request.requestId, false)">
        Deny
      </HstButton>
      <HstButton color="default" type="button" @click="agents?.reply(request.requestId, true, true)">
        Allow for session
      </HstButton>
      <HstButton color="primary" type="button" @click="agents?.reply(request.requestId, true)">
        Allow once
      </HstButton>
    </div>
  </section>
  <section v-else-if="question" class="htw:absolute htw:end-6 htw:bottom-6 htw:z-60 htw:w-[min(440px,calc(100%-32px))] htw:p-[18px] htw:rounded-[14px] htw:bg-surface htw:text-text htw:shadow-panel" aria-labelledby="histoire-agent-question-title">
    <header class="htw:flex htw:items-center htw:justify-between htw:gap-2 htw:mt-0 htw:mx-0 htw:mb-3">
      <h2 id="histoire-agent-question-title" class="htw:flex htw:items-center htw:gap-2 htw:m-0 htw:text-[14px] htw:font-semibold">
        <BuiltinIcon icon="bot" :size="18" />{{ questionAgent }} is waiting for your input
      </h2>
      <HstButton v-if="threads && question.threadId" color="flat" type="button" @click="threads.reveal(question.threadId)">
        Open thread
      </HstButton>
    </header>
    <AgentPlanApproval v-if="'kind' in question" class="htw:m-0 htw:p-0 htw:border-0 htw:bg-transparent" :request="question" />
    <AgentElicitation v-else class="htw:m-0 htw:p-0 htw:border-0 htw:bg-transparent" :request="question" />
  </section>
</template>
