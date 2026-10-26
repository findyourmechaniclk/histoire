<script setup lang="ts">
import type { UiAiThreadDraft, UiCommentAgent, UiCommentAttachment, UiCommentSessionOptions } from '@histoire/shared'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { nextTick, onMounted, ref, watch } from 'vue'

import CommentContext from './CommentContext.vue'
import { useCommentDestination } from './destination.js'
import AgentPrompt from './prompt/AgentPrompt.vue'

const props = defineProps<{
  /** Scroll wrapper owns elevation in canvas overlays. */
  flat?: boolean
  /** Current exact-frame draft. */
  draft: UiAiThreadDraft
  /** Collected story and variant display label. */
  title: string
  /** Safe ACP preset display state. */
  agents: readonly UiCommentAgent[]
  /** Screenshot request currently belongs to this draft. */
  capturing?: boolean
}>()
const emit = defineEmits<{
  /** Save and invoke chosen agent through one server request, with its session choices. */
  send: [draft: UiAiThreadDraft, agentId: string, options: UiCommentSessionOptions]
  /** Capture current exact frame through existing screenshot service. */
  attach: []
  /** Dismiss floating composer. */
  close: []
  /** Open AI agent settings. */
  setupAgent: []
  /** Detach captured screenshot from draft. */
  removeScreenshot: []
}>()
const body = ref(props.draft.body)
const attachments = ref<UiCommentAttachment[]>(props.draft.attachments ?? [])
const options = ref<UiCommentSessionOptions>({})
const prompt = ref<InstanceType<typeof AgentPrompt>>()
const { agentId, usable, choose, reset } = useCommentDestination(() => props.agents)
watch(() => props.draft.id, async () => {
  body.value = props.draft.body
  attachments.value = props.draft.attachments ?? []
  options.value = {}
  reset()
  // The keyed prompt remounts for the new draft; focus the fresh field.
  await nextTick()
  prompt.value?.focus()
})
// Session choices are agent-specific (models, modes); another agent starts from its defaults.
watch(agentId, () => options.value = {})
onMounted(() => prompt.value?.focus())
/** Attach menu and capture shortcut share the current capture gate. */
function attach() {
  if (!props.capturing) emit('attach')
}
/** Draft with the current text and attachments over immutable point context. */
function current(): UiAiThreadDraft {
  return { ...props.draft, body: body.value, attachments: attachments.value.length ? attachments.value : undefined }
}
/** Composer dispatches current text together with immutable point context. */
function send() {
  if (body.value.trim() && agentId.value && !props.capturing) emit('send', current(), agentId.value, options.value)
}
</script>

<template>
  <form class="htw:w-90 htw:[max-width:calc(100vw_-_24px)] htw:bg-surface htw:text-text htw:rounded-panel htw:overflow-hidden" :class="flat ? 'htw:shadow-none' : 'htw:shadow-panel'" aria-label="Comment for AI" @submit.prevent="send" @keydown.escape.stop.prevent="emit('close')">
    <div class="htw:flex htw:items-start htw:border-b htw:border-border">
      <CommentContext :title="title" :thread="draft" hide-screenshot borderless class="htw:flex-1 htw:min-w-0" />
      <HstButton icon-only color="flat" type="button" class="htw:text-muted htw:flex-none htw:mt-3 htw:mr-3 htw:mb-0 htw:ml-0" aria-label="Close comment" title="Close comment (Esc)" @click="emit('close')">
        <BuiltinIcon icon="close" :size="16" />
      </HstButton>
    </div>
    <div class="htw:p-3">
      <!-- Keyed by draft so a late upload of the previous draft cannot land in this one. -->
      <AgentPrompt :key="draft.id" ref="prompt" v-model="body" v-model:attachments="attachments" v-model:options="options" label="Comment message" placeholder="Describe what to change…" :agents="usable" :agent-id="agentId" :pending="capturing" :capture="attach" :screenshot="draft.screenshot" @remove-screenshot="emit('removeScreenshot')" @choose="choose" @send="send" @setup-agent="emit('setupAgent')" />
    </div>
  </form>
</template>
