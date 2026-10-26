<script setup lang="ts">
import type { WorkbenchSearchResult } from './query.js'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { getHistoireTargetKey } from '@histoire/protocol'
import { computed } from 'vue'
import { isContextMenuShortcut, useContextMenu } from '../../../composables/context-menu.js'

import { getSearchResultDomId } from './accessibility.js'

const props = defineProps<{
  /** Exact result owned by current query publication. */
  result: WorkbenchSearchResult
  /** Query used only for plain-text match emphasis. */
  query: string
  /** Keyboard-highlighted row. */
  active: boolean
  /** Session-selected target. */
  selected: boolean
}>()
const emit = defineEmits<{
  /** Activate this exact row with optional isolated preview intent. */
  activate: [isolated: boolean]
  /** Synchronize keyboard highlight on native row focus. */
  focus: []
}>()
const menu = useContextMenu()
/** Variant context names its story without duplicating folder path text. */
const title = computed(() => props.result.kind === 'variant' && props.result.path.length ? `${props.result.path.at(-1)} › ${props.result.title}` : props.result.title)
/** Literal text ranges never render index excerpts as HTML. */
const pieces = computed(() => {
  const text = title.value
  const query = props.query.trim().toLocaleLowerCase()
  const index = query ? text.toLocaleLowerCase().indexOf(query) : -1
  return index < 0 ? [{ text, matched: false }] : [{ text: text.slice(0, index), matched: false }, { text: text.slice(index, index + query.length), matched: true }, { text: text.slice(index + query.length), matched: false }]
})
/** Compact contextual second line mirrors the result boards. */
const detail = computed(() => props.result.excerpt || props.result.path.slice(0, props.result.kind === 'variant' ? -1 : undefined).join(' › '))

/** Search menu retains result identity and leaves anchor-aware activation to its owner. */
function openMenu(event: MouseEvent | KeyboardEvent): void {
  const target = props.result.target
  menu?.open(event, {
    kind: 'search-result',
    key: props.result.id,
    label: title.value,
    selection: target,
    frame: target.variantId ? { storyId: target.storyId, variantId: target.variantId, frameKey: getHistoireTargetKey(target) } : undefined,
  }, ['search.open-result', 'context.copy-link'])
}

/** Open the row menu from the keyboard without hijacking other row shortcuts. */
function onKeydown(event: KeyboardEvent): void {
  if (isContextMenuShortcut(event)) openMenu(event)
}
</script>

<template>
  <HstButton :id="getSearchResultDomId(result.id)" color="flat" type="button" class="htw:flex htw:items-start htw:gap-2.5 htw:w-full htw:py-row-list htw:px-pane-row-inset htw:text-left htw:text-text htw:hover:bg-chip htw:data-[active]:bg-accent-soft htw:focus-visible:[outline:2px_solid_var(--histoire-accent)] htw:focus-visible:outline-offset-[-2px]" :data-active="active || undefined" data-test-id="search-item" :data-search-kind="result.kind" :aria-current="selected ? 'true' : undefined" @focus="emit('focus')" @click="emit('activate', $event.metaKey || $event.ctrlKey)" @contextmenu="openMenu" @keydown="onKeydown">
    <BuiltinIcon :icon="result.kind === 'docs' ? 'document' : result.kind === 'prop' ? 'settings-adjust' : 'cube'" class="htw:w-4.5 htw:h-4.5 htw:flex-none htw:text-accent htw:mt-[1px]" :style="{ color: result.iconColor }" :size="16" />
    <span class="htw:flex-1 htw:min-w-0 htw:grid htw:gap-[3px]">
      <strong class="htw:text-[13px] htw:font-semibold"><template v-for="(piece, index) in pieces" :key="index"><mark v-if="piece.matched" class="htw:text-inherit htw:bg-transparent htw:font-bold">{{ piece.text }}</mark><template v-else>{{ piece.text }}</template></template></strong>
      <small v-if="detail" class="htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap htw:text-muted htw:text-[12px]">{{ detail }}</small>
    </span>
  </HstButton>
</template>
