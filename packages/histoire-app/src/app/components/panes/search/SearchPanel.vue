<script setup lang="ts">
import type { HistoireSearchResult, HistoireTarget } from '@histoire/protocol'
import type { ClientCommand } from '@histoire/shared'
import type { createStandaloneCommands } from '../../../standalone/commands.js'
import type { WorkbenchSearchRuntime, WorkbenchSearchState } from './controller.js'
import type { SearchScope, WorkbenchSearchResult } from './query.js'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { getHistoireTargetKey } from '@histoire/protocol'
import { useHistoireContext, useHistoireResource } from '@histoire/vue/internal'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useContextMenu } from '../../../composables/context-menu.js'
import CommandPrompts from '../../command/CommandPrompts.vue'
import WorkbenchVirtualList from '../../lists/WorkbenchVirtualList.vue'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'
import WorkbenchLoadingState from '../../shell/WorkbenchLoadingState.vue'

import { getSearchCommandDomId, SEARCH_ACTIVE_RESULT_ID, SEARCH_RESULTS_ID } from './accessibility.js'
import { createWorkbenchCommandExecutor } from './command-execution.js'
import { createWorkbenchSearchController } from './controller.js'
import { getSearchActivationResult, getSearchFrameMatches } from './query.js'
import SearchResultList from './SearchResultList.vue'
import SearchScopes from './SearchScopes.vue'

const props = defineProps<{
  /** Existing standalone plugin actions and prompt context. */
  commands: ReturnType<typeof createStandaloneCommands>
  /** Selected runtime owner; canvas frames hold prop metadata, not the canonical session. */
  runtime?: WorkbenchSearchRuntime
}>()
const emit = defineEmits<{
  /** Completed canonical activation, retaining original docs anchor. */
  select: [result: HistoireSearchResult]
  /** Open exact result in an isolated preview through host URL adapter. */
  isolated: [target: HistoireTarget]
  /** Matching exact canvas frame keys. */
  highlight: [keys: string[]]
  /** Toolbar-style next matching frame intent. */
  nextMatch: []
  /** Escape returns focus through shell. */
  close: []
  /** Raw query for shell/canvas state. */
  query: [value: string]
  /** Failed activation or command execution. */
  error: [error: unknown]
}>()
const context = useHistoireContext()
const menu = useContextMenu()
const snapshot = shallowRef(context.session.getSnapshot())
useHistoireResource(context.session.subscribe(value => snapshot.value = value))
const input = ref<HTMLInputElement | null>(null)
const query = ref('')
const scope = ref<SearchScope>('all')
const state = shallowRef<WorkbenchSearchState>({ query: '', loading: false, results: [], error: null })
const search = createWorkbenchSearchController(context.session, value => state.value = value, props.runtime)
useHistoireResource(search.close)
let active = true
let activationGeneration = 0
useHistoireResource(() => {
  active = false
})
const selectedCommand = shallowRef<ClientCommand | null>(null)
// The adapter keeps Node-backed commands dev-only; extension plugin commands also list in static books.
const commands = computed(() => {
  void snapshot.value
  return query.value.startsWith('>') ? props.commands.list(query.value.slice(1).trim()) : []
})
const results = computed(() => state.value.results.filter(result => scope.value === 'all' || (scope.value === 'stories' ? result.kind === 'story' || result.kind === 'variant' : result.kind === (scope.value === 'props' ? 'prop' : 'docs'))))
const ordered = results
const index = ref(0)
/** Default cursor follows ranking until keyboard or native row focus owns a result. */
let hasCursorIntent = false
const activeId = computed(() => ordered.value[index.value]?.id)
const commandRows = computed(() => commands.value.map(command => ({ key: command.id, command })))
/** Screen readers need exact keyboard intent while native focus remains in input. */
const activeCursor = computed(() => {
  const count = ordered.value.length + commands.value.length
  const result = ordered.value[index.value]
  if (result) return { label: `${result.title}, ${result.kind === 'docs' ? 'documentation' : result.kind} result, ${index.value + 1} of ${count}` }
  const command = commands.value[index.value - ordered.value.length]
  return command ? { label: `${command.label}, command, ${index.value + 1} of ${count}` } : undefined
})
const commandList = ref<{ reveal: (key: string) => Promise<void> }>()
const unregisterOpenResult = menu?.register({
  id: 'search.open-result',
  label: 'Open result',
  icon: 'launch',
  group: 'open',
  available: target => target.kind === 'search-result' && Boolean(ordered.value.some(result => result.id === target.key)),
  run: async (target) => {
    if (target.kind !== 'search-result') return
    const result = ordered.value.find(item => item.id === target.key)
    if (result) await activate(result)
  },
})
if (unregisterOpenResult) useHistoireResource(unregisterOpenResult)
watch(() => commands.value[index.value - ordered.value.length]?.id, key => key && void commandList.value?.reveal(key), { flush: 'post' })
const currentStory = computed(() => snapshot.value.catalog.stories.find(story => story.id === snapshot.value.selection?.storyId))
const matches = computed(() => query.value.trim() ? getSearchFrameMatches(results.value, currentStory.value) : [])
watch(matches, value => emit('highlight', value), { immediate: true })
onBeforeUnmount(() => {
  emit('highlight', [])
  emit('query', '')
})
watch(query, (value) => {
  activationGeneration++
  hasCursorIntent = false
  emit('query', value)
  search.search(value)
  index.value = 0
  selectedCommand.value = null
}, { flush: 'sync' })
watch([ordered, commands], ([rows, actions], [oldRows, oldActions]) => {
  // Loaded props can arrive before source results. Until the user navigates,
  // first Enter must follow the strongest current result rather than that prop.
  if (!hasCursorIntent) {
    index.value = 0
    return
  }
  const previous = [...oldRows.map(row => row.id), ...oldActions.map(command => command.id)][index.value]
  // Removing a visible command retires its keyboard intent. Another command
  // cannot acquire Enter merely by occupying the former array position.
  index.value = previous ? [...rows.map(row => row.id), ...actions.map(command => command.id)].indexOf(previous) : -1
}, { flush: 'sync' })

/** Native result focus claims exact identity, never a retired row's old position. */
function focusResult(id: string) {
  const position = ordered.value.findIndex(result => result.id === id)
  if (position < 0) return
  hasCursorIntent = true
  index.value = position
}

/** Command focus uses its live registry ID across reactive availability changes. */
function focusCommand(id: string) {
  const position = commands.value.findIndex(command => command.id === id)
  if (position < 0) return
  hasCursorIntent = true
  index.value = ordered.value.length + position
}

/** Pane openings and explicit search shortcuts share the mounted input focus action. */
async function focus() {
  await nextTick()
  if (active) {
    input.value?.focus()
    input.value?.select()
  }
}
onMounted(focus)
defineExpose({ focus, search: (value: string) => query.value = value })

/** Use canonical selection; detached/stale query rows cannot open a new target. */
async function activate(result: WorkbenchSearchResult, isolated = false) {
  if (!ordered.value.some(row => row.id === result.id)) return
  const generation = ++activationGeneration
  if (isolated) {
    emit('isolated', result.target)
    return
  }
  const source = snapshot.value.source
  const ownedQuery = query.value
  /** Errors can occur before selection succeeds, but still require exact live query/source intent. */
  function ownsFeedback() {
    const current = context.session.getSnapshot()
    return active && generation === activationGeneration && query.value === ownedQuery && !current.stale && current.source?.sourceId === source?.sourceId && current.source?.epoch === source?.epoch && current.source?.revision === source?.revision
  }
  /** Route completion may await; only its exact live target can dismiss. */
  function ownsActivation() {
    const current = context.session.getSnapshot()
    return ownsFeedback() && !!current.selection && getHistoireTargetKey(current.selection) === getHistoireTargetKey(result.target)
  }
  try {
    await context.session.selection.select(result.target)
    if (!ownsActivation()) return
    const value = getSearchActivationResult(result)
    if (!context.panels.showDocs(value, source)) return
    await props.commands.activateSearch(value)
    if (ownsActivation()) emit('select', value)
  }
  catch (error) { if (ownsFeedback()) emit('error', error) }
}

/** Prompt submission retains transport contract and captured feedback ownership. */
const commandExecutor = createWorkbenchCommandExecutor(context.session, () => props.commands, () => activationGeneration, error => emit('error', error))
useHistoireResource(commandExecutor.close)
const execute = commandExecutor.execute

/** Selecting a prompt command only opens its form. */
function activateCommand(command: ClientCommand) {
  if (!commands.value.some(row => row.id === command.id)) return
  if (command.prompts?.length) {
    selectedCommand.value = command
  }
  else {
    try {
      execute(command, command.getParams?.(props.commands.context()) ?? {})
    }
    catch (error) { emit('error', error) }
  }
}

/** Input owns search navigation; Tab advances canvas matches without leaving this pane. */
function keydown(event: KeyboardEvent) {
  if (selectedCommand.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    query.value = ''
    emit('close')
    return
  }
  if (event.key === 'Tab' && matches.value.length && !event.shiftKey) {
    event.preventDefault()
    emit('nextMatch')
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return
  // Native row Enter carries its own exact owner; only input Enter uses index.
  if (event.key === 'Enter' && event.target !== input.value) return
  event.preventDefault()
  const count = ordered.value.length + commands.value.length
  if (!count) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    hasCursorIntent = true
    index.value = index.value < 0 ? event.key === 'ArrowDown' ? 0 : count - 1 : (index.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
  }
  else if (ordered.value[index.value]) {
    void activate(ordered.value[index.value], event.metaKey || event.ctrlKey)
  }
  else if (commands.value[index.value - ordered.value.length]) {
    activateCommand(commands.value[index.value - ordered.value.length])
  }
}
</script>

<template>
  <!-- Keep workbench layout independent of the portable SDK search styles. -->
  <section class="htw:flex-1 htw:py-4 htw:px-pane-gutter htw:overflow-auto htw:min-w-0 htw:min-h-0 htw:bg-surface htw:text-text" aria-label="Search" :aria-busy="state.loading" data-test-id="search-modal" @keydown="keydown">
    <label class="htw:flex htw:items-center htw:gap-3 htw:box-border htw:w-full htw:min-w-0 htw:h-10 htw:py-0 htw:px-3 htw:mt-0 htw:mx-0 htw:mb-2 htw:border htw:border-solid htw:border-border htw:rounded-[12px] htw:bg-input htw:text-text htw:focus-within:border-accent htw:focus-within:shadow-[0_0_0_1px_var(--histoire-accent)]">
      <BuiltinIcon class="htw:text-muted htw:w-4.5 htw:h-4.5 htw:flex-none" icon="search" aria-hidden="true" :size="16" />
      <input
        ref="input"
        v-model="query"
        class="htw:flex-1 htw:min-w-0 htw:h-full htw:p-0 htw:border-0 htw:[outline:0] htw:bg-transparent htw:text-inherit htw:[font-family:inherit] htw:[font-size:inherit] htw:[font-weight:inherit] htw:leading-[inherit] htw:appearance-none htw:placeholder:text-muted htw:placeholder:opacity-[1] htw:[&::-webkit-search-cancel-button]:hidden htw:[&::-webkit-search-cancel-button]:appearance-none"
        type="search"
        aria-label="Search stories, docs and props"
        :aria-controls="SEARCH_RESULTS_ID"
        :aria-describedby="activeCursor ? SEARCH_ACTIVE_RESULT_ID : undefined"
        placeholder="Search…"
        autocomplete="off"
      >
      <kbd class="htw:flex-none htw:text-muted htw:font-mono htw:text-[11px]" aria-hidden="true">esc</kbd>
    </label>
    <SearchScopes v-model="scope" />
    <p v-if="state.error" class="htw:my-5 htw:mx-0 htw:text-muted htw:text-[12px]" role="status">
      Search index unavailable. Loaded props remain searchable.
    </p>
    <WorkbenchLoadingState v-if="query.trim() && state.loading && !ordered.length && !commands.length" fill flush class="htw:my-12 htw:mx-0" title="Searching…" />
    <WorkbenchEmptyState v-if="query.trim() && !state.loading && !ordered.length && !commands.length" fill flush class="htw:my-12 htw:mx-0" icon="search" title="No matches">
      Nothing for <q class="htw:text-text">{{ query.trim() }}</q><template v-if="scope !== 'all'">
        in {{ scope }}
      </template>
      <template v-if="scope !== 'all'" #actions>
        <HstButton color="flat" tone="accent" @click="scope = 'all'">
          Search everything
        </HstButton>
      </template>
    </WorkbenchEmptyState>
    <p v-if="activeCursor" :id="SEARCH_ACTIVE_RESULT_ID" class="htw:absolute htw:w-[1px] htw:h-[1px] htw:overflow-hidden htw:[clip:rect(0_0_0_0)] htw:whitespace-nowrap" role="status" aria-live="polite" data-search-active-result>
      {{ activeCursor.label }}
    </p>
    <div :id="SEARCH_RESULTS_ID">
      <SearchResultList :results="ordered" :query="query" :active-id="activeId" :selection="snapshot.selection" @activate="activate" @focus="focusResult" />
      <section v-if="commands.length" class="htw:mt-5.5" aria-label="Commands">
        <h3 class="htw:py-0 htw:px-pane-row-inset htw:text-muted htw:text-[12px]">
          Commands
        </h3>
        <WorkbenchVirtualList ref="commandList" :items="commandRows" :min-item-size="40" page-mode list-tag="ul" item-tag="li">
          <template #default="{ item, index: position }">
            <HstButton :id="getSearchCommandDomId(item.command.id)" class="htw:flex htw:gap-2.5 htw:items-center htw:w-full htw:py-2.5 htw:px-pane-row-inset htw:text-inherit htw:text-left htw:data-[active]:bg-accent-soft htw:focus-visible:[outline:2px_solid_var(--histoire-accent)] htw:focus-visible:outline-offset-[-2px]" color="flat" type="button" data-test-id="search-item" data-search-kind="command" :data-active="index === ordered.length + position || undefined" @focus="focusCommand(item.command.id)" @click="activateCommand(item.command)">
              <BuiltinIcon icon="terminal" :size="16" />{{ item.command.label }}
            </HstButton>
          </template>
        </WorkbenchVirtualList>
      </section>
    </div>
    <CommandPrompts v-if="selectedCommand" :command="selectedCommand" :context="props.commands.context()" :execute="execute" @close="selectedCommand = null" />
  </section>
</template>
