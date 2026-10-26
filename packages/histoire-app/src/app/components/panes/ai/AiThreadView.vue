<script setup lang="ts">
import type { HistoireTarget } from '@histoire/protocol'
import type { UiAiThread, UiCommentAgent } from '@histoire/shared'
import type { AiThreads } from '../../../stores/ai-threads.js'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { computed, ref, watch } from 'vue'
import { isThreadBusy } from '../../../stores/agent-threads.js'
import { agentDisplay, useCommentDestination } from '../../comments/destination.js'
import AgentPrompt from '../../comments/prompt/AgentPrompt.vue'
import { PLAN_FOLLOW_UP_PLACEHOLDER, usePlanFollowUp } from '../../comments/prompt/plan-follow-up.js'
import { useReplyDrafts } from '../../comments/reply-draft.js'
import AgentLiveTail from '../../comments/thread/AgentLiveTail.vue'
import AgentPendingInput from '../../comments/thread/questions/AgentPendingInput.vue'
import { useStickToBottom } from '../../comments/thread/stick-to-bottom.js'
import ThreadMessage from '../../comments/thread/ThreadMessage.vue'
import AiCreatedStories from './AiCreatedStories.vue'
import AiThreadHeader from './AiThreadHeader.vue'

const props = defineProps<{
  /** Open conversation. */
  thread: UiAiThread
  /** Shared AI threads state. */
  model: AiThreads
  /** Current safe agent display states. */
  agents: readonly UiCommentAgent[]
  /** Selected-variant screenshot capture, attached to the message. */
  capture?: () => Promise<string>
}>()
const emit = defineEmits<{
  /** Navigate to a story the agent created or changed. */
  select: [target: HistoireTarget]
}>()
const live = computed(() => props.model.streaming.value[props.thread.id])
const busy = computed(() => isThreadBusy(props.thread))
const disabled = computed(() => !props.model.available.value)
const scroller = ref<HTMLElement>()
const log = ref<HTMLElement>()
useStickToBottom(scroller, log, () => `${props.thread.id}:${props.thread.thread.length}`)
/** Destination for a thread whose first send failed; bound threads keep theirs. */
const { agentId, usable, choose, reset } = useCommentDestination(() => props.agents)
watch(() => props.thread.id, reset)
/** Reply drafts per thread; session choices stay with the agent they were made for. */
const { draft, edit, options, choose: chooseOptions, sent } = useReplyDrafts(() => props.thread.id, () => props.thread.agentId ?? agentId.value)
/** Files changed by every agent reply in the thread. */
const changes = computed(() => props.thread.thread.flatMap(message => message.changes ?? []))
const prompt = ref<InstanceType<typeof AgentPrompt>>()
/** Latest reply kept planning: ask what should change. */
const keptPlanning = usePlanFollowUp(() => props.thread, prompt)
/** Configured display metadata for an agent id. */
function agent(id?: string): { name: string, icon?: string } {
  return agentDisplay(props.agents, id)
}
/** Send the reply once; the draft clears only when the channel accepted it. */
function submit() {
  const { body, attachments } = draft.value
  if (!body.trim() || busy.value || disabled.value) return
  const destination = props.thread.agentId ? undefined : agentId.value || undefined
  if (props.model.reply(props.thread.id, body, { ...destination ? { agentId: destination } : {}, ...attachments.length ? { attachments } : {}, ...options.value ? { options: options.value } : {} })) sent()
}
</script>

<template>
  <section class="htw:flex htw:flex-1 htw:flex-col htw:min-h-0" aria-label="AI thread">
    <AiThreadHeader :title="thread.title" @back="model.back()">
      <HstButton class="htw:text-muted" icon-only color="flat" type="button" :disabled="disabled" :aria-label="thread.status === 'resolved' ? 'Restore thread' : 'Archive thread'" :title="thread.status === 'resolved' ? 'Restore' : 'Archive'" @click="model.archive(thread.id, thread.status !== 'resolved')">
        <BuiltinIcon :icon="thread.status === 'resolved' ? 'renew' : 'checkmark'" :size="16" />
      </HstButton>
      <HstButton class="htw:text-muted" icon-only color="flat" type="button" :disabled="disabled || busy" aria-label="Delete thread" title="Delete" @click="model.remove(thread.id)">
        <BuiltinIcon icon="trash-can" :size="16" />
      </HstButton>
    </AiThreadHeader>
    <div ref="scroller" class="htw:flex-1 htw:min-h-0 htw:overflow-auto htw:py-4 htw:px-pane-gutter">
      <div ref="log">
        <ThreadMessage author="user" name="You" :at="thread.createdAt" :body="thread.body" :attachments="thread.attachments" />
        <ThreadMessage
          v-for="(message, index) in thread.thread"
          :key="index"
          :author="message.author"
          :name="message.author === 'agent' ? agent(message.agentId).name : 'You'"
          :icon="message.author === 'agent' ? agent(message.agentId).icon : undefined"
          :at="message.at"
          :body="message.body"
          :steps="message.steps"
          :plan="message.plan"
          :decisions="message.decisions"
          :changes="message.changes"
          :failed="message.failed"
          :attachments="message.attachments"
        />
        <ThreadMessage v-if="busy" author="agent" :name="agent(thread.agentId).name" :icon="agent(thread.agentId).icon" :body="live?.text ?? ''" :steps="live?.steps" :plan="live?.plan" streaming aria-live="polite">
          <AgentLiveTail :thread-id="thread.id" :steps="live?.steps ?? []" :text="live?.text ?? ''" :started-at="live?.startedAt" :queued="thread.status === 'sent'" />
        </ThreadMessage>
        <!-- Questions span the whole thread width, below the working reply. -->
        <AgentPendingInput v-if="busy" :thread-id="thread.id" />
        <AiCreatedStories :changes="changes" @select="emit('select', $event)" />
      </div>
    </div>
    <form class="htw:p-pane-gutter htw:border-t htw:border-solid htw:border-border" @submit.prevent="submit">
      <AgentPrompt :key="thread.id" ref="prompt" :capture="capture" :model-value="draft.body" :attachments="draft.attachments" :options="options ?? thread.options" compact label="Reply to thread" :placeholder="busy ? 'Agent is working…' : keptPlanning ? PLAN_FOLLOW_UP_PLACEHOLDER : 'Reply…'" :agents="thread.agentId ? agents : usable" :agent-id="thread.agentId ?? agentId" :agent-locked="Boolean(thread.agentId)" :busy="busy" :disabled="disabled" @update:model-value="edit({ body: $event })" @update:attachments="edit({ attachments: $event })" @update:options="chooseOptions" @choose="choose" @send="submit" />
    </form>
  </section>
</template>
