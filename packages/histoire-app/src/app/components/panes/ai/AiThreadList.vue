<script setup lang="ts">
import type { UiAiThread, UiCommentAgent } from '@histoire/shared'
import type { AiThreads } from '../../../stores/ai-threads.js'
import { BuiltinIcon, HstButton, HstPulsatingDisc } from '@histoire/controls/vue'
import { useHistoireSnapshot } from '@histoire/vue'
import { computed } from 'vue'
import { isContextMenuShortcut } from '../../../composables/context-menu.js'
import { isThreadBusy } from '../../../stores/agent-threads.js'
import { useAgentsStore } from '../../../stores/agents.js'
import AgentLogo from '../../agents/AgentLogo.vue'
import { commentAge, groupThreads, isOnCanvas, pinNumbers } from '../../comments/presentation.js'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'
import WorkbenchPaneList from '../../shell/WorkbenchPaneList.vue'

const props = defineProps<{
  /** Shared AI threads state. */
  model: AiThreads
  /** Current safe agent display states. */
  agents: readonly UiCommentAgent[]
}>()
const emit = defineEmits<{
  /** Open a pinned thread's card on the canvas. */
  selectPin: [id: string]
  /** Row context menu, with the thread it targets. */
  contextmenu: [event: MouseEvent | KeyboardEvent, thread: UiAiThread]
}>()
const snapshot = useHistoireSnapshot()
const agentsStore = useAgentsStore()
/** Threads blocked on a question for the user. */
const needsInput = computed(() => new Set(agentsStore?.needsInput.value))
/** Selected story first, then the rest. */
const groups = computed(() => groupThreads(props.model.visible.value, snapshot.value.selection?.storyId))
/** Pin numbers follow all pinned threads, so filtering never renumbers them. */
const numbers = computed(() => pinNumbers(props.model.threads.value))
/** Registry logo of the thread agent, when known. */
function icon(agentId?: string): string | undefined {
  return props.agents.find(agent => agent.id === agentId)?.icon
}
/** Pinned threads with a live variant open on the canvas; others (orphans included) open in the pane. */
function select(thread: UiAiThread): void {
  if (isOnCanvas(thread, snapshot.value.catalog.stories)) emit('selectPin', thread.id)
  else props.model.open(thread.id)
}
/** Keyboard menu access without intercepting ordinary keys. */
function onKeydown(event: KeyboardEvent, thread: UiAiThread): void {
  if (isContextMenuShortcut(event)) emit('contextmenu', event, thread)
}
</script>

<template>
  <WorkbenchPaneList>
    <section v-for="group in groups" :key="group.title" :aria-label="group.title">
      <h3 class="htw:m-0 htw:pt-3 htw:px-pane-row-inset htw:pb-1.5 htw:text-muted htw:text-[11px] htw:font-bold">
        {{ group.title }}
      </h3>
      <ul class="htw:m-0 htw:p-0 htw:list-none">
        <li v-for="thread in group.threads" :key="thread.id">
          <button type="button" class="htw:flex htw:items-center htw:gap-2 htw:w-full htw:py-row-list htw:px-pane-row-inset htw:border-0 htw:rounded-control htw:bg-transparent htw:text-text htw:[font-family:inherit] htw:text-[13px] htw:[font-weight:inherit] htw:leading-[inherit] htw:text-left htw:cursor-pointer htw:hover:bg-chip htw:focus-visible:bg-chip htw:aria-[current=true]:bg-agent-soft htw:data-[archived]:text-muted" :data-archived="thread.status === 'resolved' || undefined" :aria-current="model.activeId.value === thread.id ? 'true' : undefined" @click="select(thread)" @contextmenu="emit('contextmenu', $event, thread)" @keydown="onKeydown($event, thread)">
            <span v-if="numbers.has(thread.id)" class="htw:grid htw:place-items-center htw:flex-none htw:w-4.5 htw:h-[19px] htw:rounded-[50%_50%_50%_3px] htw:bg-agent htw:text-white htw:text-[9px] htw:font-bold htw:data-[muted]:bg-muted" :data-muted="thread.status === 'draft' || thread.status === 'resolved' || undefined" data-pin>{{ numbers.get(thread.id) }}</span>
            <AgentLogo v-else :icon="icon(thread.agentId)" :size="16" />
            <span class="htw:flex-1 htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap">{{ thread.title }}</span>
            <span v-if="needsInput.has(thread.id)" class="htw:flex htw:flex-none htw:text-agent-text" role="img" aria-label="Needs your input" title="Needs your input"><BuiltinIcon icon="help" :size="14" /></span>
            <HstPulsatingDisc v-else-if="isThreadBusy(thread)" :size="10" />
            <time v-else class="htw:flex-none htw:text-muted htw:text-[11px]" :datetime="thread.updatedAt">{{ commentAge(thread.updatedAt) }}</time>
          </button>
        </li>
      </ul>
    </section>
    <WorkbenchEmptyState v-if="!groups.length && model.showArchived.value" icon="archive" title="No archived threads" />
    <WorkbenchEmptyState v-else-if="!groups.length" icon="bot" title="No threads">
      <template #actions>
        <HstButton color="flat" tone="accent" type="button" :disabled="!model.available.value" @click="model.compose()">
          New thread
        </HstButton>
      </template>
    </WorkbenchEmptyState>
  </WorkbenchPaneList>
</template>
