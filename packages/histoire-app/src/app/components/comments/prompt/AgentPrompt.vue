<script setup lang="ts">
import type { UiCommentAgent, UiCommentAttachment, UiCommentSessionOptions } from '@histoire/shared'
import type { PromptCapture } from './actions.js'
import type { PromptSuggestionSources } from './suggestions.js'
import { BuiltinIcon, HstButton, HstPulsatingDisc } from '@histoire/controls/vue'
import { computed, ref, useId, watch } from 'vue'
import { useAgentDiscovery } from '../../../composables/agent-discovery.js'
import { useAgentsStore } from '../../../stores/agents.js'
import { searchProjectFiles } from '../../../util/comments-http.js'
import { isMac } from '../../../util/env.js'
import { formatKey } from '../../../util/keyboard.js'
import { usePromptActions } from './actions.js'
import { usePromptAttachments } from './attachments.js'
import AttachmentStrip from './AttachmentStrip.vue'
import { useAutoGrow } from './autogrow.js'
import PromptAttachMenu from './PromptAttachMenu.vue'
import PromptSuggestions from './PromptSuggestions.vue'
import SessionPicker from './SessionPicker.vue'
import { useSuggestions } from './suggestions.js'

const props = withDefaults(defineProps<{
  /** Message text. */
  modelValue: string
  /** Accessible name of the message field. */
  label: string
  /** Empty-field hint. */
  placeholder: string
  /** Usable agents for the picker. */
  agents: readonly UiCommentAgent[]
  /** Current destination agent. */
  agentId: string
  /** Destination is bound to an existing conversation. */
  agentLocked?: boolean
  /** Files attached to this message. */
  attachments?: readonly UiCommentAttachment[]
  /** Agent session choices (model, effort, mode). */
  options?: UiCommentSessionOptions
  /** Agent is producing output; input and send are blocked. */
  busy?: boolean
  /** Blocks input and send (disconnected session). */
  disabled?: boolean
  /** Request or capture in flight; text stays editable, send waits. */
  pending?: boolean
  /** One-line starting height for thread replies. */
  compact?: boolean
  /** Screenshot capture offered in the attach menu and on its shortcut. */
  capture?: PromptCapture
  /** Canvas screenshot captured for a comment draft. */
  screenshot?: string
}>(), { attachments: () => [] })
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:attachments': [value: UiCommentAttachment[]]
  'update:options': [value: UiCommentSessionOptions]
  /** Explicit agent pick. */
  'choose': [id: string]
  /** Submit current message. */
  'send': []
  /** Open AI agent settings when no agent is usable. */
  'setupAgent': []
  /** Detach the comment draft's canvas screenshot. */
  'removeScreenshot': []
}>()
defineSlots<{
  /** Context chips shown above the attachments (story context, ...). */
  chips?: () => any
  /** Leading toolbar tools. */
  tools?: () => any
  /** Secondary actions placed before send. */
  extra?: () => any
}>()
const input = ref<HTMLTextAreaElement>()
const picker = ref<HTMLInputElement>()
const listId = `prompt-suggestions-${useId()}`
useAutoGrow(input, () => props.modelValue)
const locked = computed(() => props.disabled || props.busy)
const hasAgent = computed(() => props.agentLocked || props.agents.length > 0)
const files = usePromptAttachments({ attachments: () => props.attachments, update: value => emit('update:attachments', value), disabled: () => locked.value })
const sendHint = `${formatKey(isMac ? 'meta' : 'ctrl')} ${formatKey('enter')}`
/** Model/effort/mode choices and probe-announced commands of the current agent. */
const { discovery } = useAgentDiscovery(useAgentsStore(), () => props.agentId || undefined)
const agent = computed(() => props.agents.find(agent => agent.id === props.agentId))
/** Live session commands win; discovery covers agents that have not run yet. */
const commands = computed(() => agent.value?.commands ?? discovery.value?.value?.commands ?? [])
/** `@` searches project files on the server; `/` lists the agent's advertised commands. */
const sources: PromptSuggestionSources = {
  '@': async query => (await searchProjectFiles(query)).map(file => ({ id: file.path, label: file.basename, detail: file.dirname, icon: 'document', insert: `@${file.path}` })),
  '/': query => commands.value.filter(command => command.name.startsWith(query)).map(command => ({ id: command.name, label: `/${command.name}`, detail: command.hint ? `${command.description} · ${command.hint}` : command.description, icon: 'terminal', insert: `/${command.name}` })),
}
const suggestions = useSuggestions({ input, update: value => emit('update:modelValue', value), sources: () => sources })
/** Why the open list has no rows. */
const emptyText = computed(() => {
  if (suggestions.trigger.value?.char === '@') return 'No matching files'
  if (commands.value.length) return 'No matching command'
  return discovery.value?.loading ? 'Loading commands…' : `No commands from ${agent.value?.name ?? 'this agent'} yet`
})
const showSuggestions = suggestions.visible
const actions = usePromptActions({ input, picker, update: value => emit('update:modelValue', value), files, suggestions, capture: () => props.capture, locked: () => locked.value })
const canSend = computed(() => Boolean(props.modelValue.trim() && (props.agentLocked || props.agentId) && !locked.value && !props.pending && !files.uploading.value && !actions.capturing.value))
// Commands discovered while the list is open replace the loading row. Agent snapshots rebuild
// the array on every update, so only a changed name set reopens the list.
watch(() => commands.value.map(command => command.name).join('\n'), () => {
  if (suggestions.trigger.value?.char !== '/') return
  suggestions.close()
  suggestions.refresh()
})

/** Field shortcut and button share one gate. */
function send(): void {
  if (canSend.value) emit('send')
}
/** Suggestion navigation first, then prompt shortcuts, then Ctrl/⌘+Enter sends. */
function keydown(event: KeyboardEvent): void {
  if (suggestions.keydown(event) || actions.keydown(event)) return
  // Enter commits IME composition; it must not send.
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    send()
  }
}
/** Caret moves can enter or leave a mention. */
function keyup(event: KeyboardEvent): void {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) suggestions.refresh()
}
/** Attach-menu action rows. */
function runAction(id: 'files' | 'screenshot' | 'mention' | 'command'): void {
  void ({ files: actions.openFiles, screenshot: actions.screenshot, mention: actions.mention, command: actions.command })[id]()
}
/** Files picked in the system dialog; reset so the same file can be picked again. */
function picked(): void {
  void files.addFiles([...picker.value?.files ?? []])
  if (picker.value) picker.value.value = ''
}
defineExpose({
  /** Move keyboard focus into the message field. */
  focus: () => input.value?.focus(),
})
</script>

<template>
  <div class="agent-prompt htw:[--histoire-control-accent:var(--histoire-agent)] htw:[--histoire-control-on-accent:#fff] htw:relative htw:flex htw:flex-col htw:border htw:border-border htw:rounded-control htw:bg-surface htw:[transition:border-color_120ms_ease,_box-shadow_120ms_ease] htw:group/prompt htw:focus-within:border-agent htw:focus-within:shadow-[0_0_0_3px_rgb(var(--histoire-agent-rgb)/0.2)] htw:data-[drop]:border-agent htw:data-[drop]:shadow-[0_0_0_3px_rgb(var(--histoire-agent-rgb)/0.2)]" :data-compact="compact" :data-disabled="locked" :data-drop="files.dropping.value || undefined" @dragover="files.dragover" @dragleave="files.dragleave" @drop="files.drop">
    <PromptSuggestions v-if="showSuggestions" :id="listId" :label="suggestions.trigger.value?.char === '/' ? 'Commands' : 'Project files'" :items="suggestions.items.value" :active="suggestions.active.value" :empty="emptyText" @pick="suggestions.pick" />
    <div v-if="$slots.chips" class="htw:flex htw:flex-wrap htw:gap-1.5 htw:pt-2 htw:px-2.5 htw:pb-0">
      <slot name="chips" />
    </div>
    <AttachmentStrip v-if="attachments.length || screenshot || files.uploading.value" class="htw:pt-2 htw:px-2.5 htw:pb-0" :attachments="attachments" :screenshot="screenshot" :uploading="files.uploading.value" removable @remove="files.remove" @remove-screenshot="emit('removeScreenshot')" />
    <!-- Auto-grow owns height; compact mode changes only its bounds. -->
    <textarea
      ref="input"
      class="htw:box-border htw:block htw:w-full htw:[min-height:4.5rem] htw:max-h-60 htw:m-0 htw:pt-2.5 htw:px-3 htw:pb-1 htw:border-0 htw:outline-none htw:bg-transparent htw:text-text htw:[font-family:inherit] htw:[font-weight:inherit] htw:[font-style:inherit] htw:text-[13px] htw:leading-[1.45] htw:resize-none htw:overflow-y-auto htw:group-data-[compact=true]/prompt:min-h-9 htw:group-data-[compact=true]/prompt:max-h-40 htw:placeholder:text-muted htw:disabled:cursor-not-allowed"
      rows="1"
      maxlength="8192"
      :value="modelValue"
      :aria-label="label"
      :placeholder="placeholder"
      :disabled="locked"
      aria-autocomplete="list"
      :aria-expanded="showSuggestions"
      :aria-controls="showSuggestions ? listId : undefined"
      :aria-activedescendant="suggestions.open.value ? `${listId}-${suggestions.active.value}` : undefined"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value); suggestions.refresh()"
      @click="suggestions.refresh"
      @keydown="keydown"
      @keyup="keyup"
      @blur="suggestions.close"
      @paste="files.paste"
    />
    <p v-if="files.notice.value" class="htw:m-0 htw:py-0.5 htw:px-3 htw:text-danger htw:text-[12px]" role="status">
      {{ files.notice.value }}
    </p>
    <div class="htw:flex htw:flex-wrap htw:items-center htw:gap-0.5 htw:pt-1 htw:px-1.5 htw:pb-1.5">
      <PromptAttachMenu :disabled="locked" :capture="Boolean(capture)" :capturing="Boolean(actions.capturing.value || pending)" :commands="commands.length > 0" :hints="{ files: actions.hint('comment.attach'), screenshot: actions.hint('comment.screenshot') }" @action="runAction" @screenshot="files.addScreenshot" />
      <input ref="picker" type="file" multiple hidden @change="picked">
      <slot name="tools" />
      <SessionPicker v-if="hasAgent" :agents="agents" :agent-id="agentId" :locked="agentLocked" :config="discovery?.value" :loading="discovery?.loading" :options="options" :disabled="locked" @choose="emit('choose', $event)" @update:options="emit('update:options', $event)" />
      <HstButton v-else color="flat" type="button" class="htw:py-1 htw:px-2 htw:text-agent htw:text-[12px] htw:font-semibold" @click="emit('setupAgent')">
        <BuiltinIcon icon="bot" :size="14" />Set up an agent
      </HstButton>
      <span class="htw:flex-1" />
      <HstButton icon-only color="primary" type="button" class="htw:[--histoire-icon-button-size:28px] htw:rounded-full" :disabled="!canSend" :aria-label="busy ? 'Agent is working' : 'Send'" :title="busy ? 'Agent is working' : `Send (${sendHint})`" @click="send">
        <HstPulsatingDisc v-if="busy" :size="12" />
        <BuiltinIcon v-else icon="send-alt-filled" :size="14" />
      </HstButton>
    </div>
  </div>
</template>
