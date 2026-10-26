<script setup lang="ts">
import type { HistoireTarget } from '@histoire/protocol'
import type { WorkbenchTestRow } from './types.js'
import { BuiltinIcon, HstButton, HstPulsatingDisc } from '@histoire/controls/vue'
import { useHistoireResource } from '@histoire/vue/internal'
import { computed, ref } from 'vue'
import { isContextMenuShortcut, useContextMenu } from '../../../composables/context-menu.js'
import WorkbenchVirtualList from '../../lists/WorkbenchVirtualList.vue'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'

import TestsTreeRow from './TestsTreeRow.vue'

/** Catalog rows remain ordered by source, grouped by exact story identity. */
const props = defineProps<{ rows: readonly WorkbenchTestRow[], filter: 'failing' | 'all' | 'changed', selected: HistoireTarget | null }>()
const emit = defineEmits<{ select: [row: WorkbenchTestRow] }>()
const menu = useContextMenu()
/** One fixed-height row in the flattened virtual project explorer. */
type TestTreeEntry =
  | { key: string, kind: 'heading', id: string, title: string, status: TestGroupStatus, count: number, total: number }
  | { key: string, kind: 'test', row: WorkbenchTestRow }
/** Aggregate story state; running wins so active work is never hidden behind an older result. */
type TestGroupStatus = 'running' | 'failed' | 'stale' | 'passed' | 'idle'
/** Glyph and accessible label per aggregate state; running uses the standard loader. */
const GROUP_STATUS: Record<TestGroupStatus, { icon?: string, label: string }> = {
  running: { label: 'Tests running' },
  failed: { icon: 'error-filled', label: 'Tests failing' },
  stale: { icon: 'renew', label: 'Tests outdated' },
  passed: { icon: 'checkmark-filled', label: 'Tests passed' },
  idle: { icon: 'subtract', label: 'Tests not run' },
}
const closed = ref(new Set<string>())
const menuDisposers = [
  menu?.register({ id: 'tests.expand-group', label: 'Expand story tests', icon: 'chevron-down', available: target => target.kind === 'test-group' && !target.expanded, run: (target) => {
    if (target.kind === 'test-group' && target.storyId) toggle(target.storyId)
  } }),
  menu?.register({ id: 'tests.collapse-group', label: 'Collapse story tests', icon: 'chevron-up', available: target => target.kind === 'test-group' && target.expanded, run: (target) => {
    if (target.kind === 'test-group' && target.storyId) toggle(target.storyId)
  } }),
].filter((dispose): dispose is () => void => Boolean(dispose))
useHistoireResource(() => menuDisposers.forEach(dispose => dispose()))
const visible = computed<TestTreeEntry[]>(() => {
  const groups = new Map<string, WorkbenchTestRow[]>()
  for (const row of props.rows) {
    const group = groups.get(row.target.storyId)
    if (group) group.push(row)
    else groups.set(row.target.storyId, [row])
  }
  const entries: TestTreeEntry[] = []
  for (const [id, all] of groups) {
    const rows = all.filter(row => props.filter === 'all' || (props.filter === 'changed' ? row.stale : row.failed))
    if (!rows.length) continue
    const hasDisclosure = !all.every(row => row.notCollected)
    if (hasDisclosure) {
      entries.push({
        key: JSON.stringify(['heading', id]),
        kind: 'heading',
        id,
        title: all[0].storyTitle,
        status: all.some(row => row.running && !row.notCollected)
          ? 'running'
          : all.some(row => row.failed)
            ? 'failed'
            : all.some(row => row.stale)
              ? 'stale'
              : all.every(row => row.summary?.ok && !row.stale) && all.some(row => row.summary?.passed) ? 'passed' : 'idle',
        count: all.reduce((sum, row) => sum + (row.summary?.passed ?? 0), 0),
        total: all.reduce((sum, row) => sum + (row.collection?.definitions.length ?? row.summary?.total ?? 0), 0),
      })
    }
    // Collection-only groups have no heading, so retained collapse state cannot hide recovery diagnostics.
    if (!hasDisclosure || !closed.value.has(id)) entries.push(...rows.map(row => ({ key: row.key, kind: 'test' as const, row })))
  }
  return entries
})
/** Empty message names the active filter once project tests exist. */
const empty = computed(() => !props.rows.length || props.filter === 'all'
  ? { icon: 'chemistry', title: 'No tests' }
  : props.filter === 'failing'
    ? { icon: 'checkmark-filled', title: 'No failing tests' }
    : { icon: 'renew', title: 'No outdated results' })
/** Folder disclosure changes only local project explorer presentation. */
function toggle(storyId: string) {
  const next = new Set(closed.value)
  if (!next.delete(storyId)) next.add(storyId)
  closed.value = next
}

/** Context group identity remains stable when its virtual row is recycled. */
function openGroupMenu(event: MouseEvent | KeyboardEvent, item: Extract<TestTreeEntry, { kind: 'heading' }>): void {
  menu?.open(event, { kind: 'test-group', key: item.key, storyId: item.id, label: item.title, expanded: !closed.value.has(item.id) }, [closed.value.has(item.id) ? 'tests.expand-group' : 'tests.collapse-group'])
}

/** Group disclosure remains keyboard accessible through native menu keys. */
function onGroupKeydown(event: KeyboardEvent, item: Extract<TestTreeEntry, { kind: 'heading' }>): void {
  if (isContextMenuShortcut(event)) openGroupMenu(event, item)
}
</script>

<template>
  <div class="htw:flex-1 htw:min-h-0 htw:overflow-hidden htw:pt-0 htw:px-pane-gutter htw:pb-4" aria-label="Project tests">
    <WorkbenchEmptyState v-if="!visible.length" :icon="empty.icon" :title="empty.title" />
    <WorkbenchVirtualList v-else :items="visible" :item-size="40" list-tag="ul" item-tag="li">
      <template #default="{ item }">
        <HstButton v-if="item.kind === 'heading'" color="flat" type="button" class="test-story-heading htw:flex htw:items-center htw:gap-2 htw:w-full htw:h-[var(--histoire-virtual-row-height,_39px)] htw:py-test-heading htw:px-pane-row-inset htw:text-text htw:leading-4.5 htw:text-left htw:hover:bg-chip htw:focus-visible:[outline:2px_solid_var(--histoire-accent)] htw:focus-visible:outline-offset-[-2px]" :aria-expanded="!closed.has(item.id)" @click="toggle(item.id)" @contextmenu="openGroupMenu($event, item)" @keydown="onGroupKeydown($event, item)">
          <BuiltinIcon :icon="closed.has(item.id) ? 'chevron-right' : 'chevron-down'" :size="16" />
          <span class="htw:text-[11px] htw:font-mono htw:text-muted htw:inline-flex htw:flex-none htw:items-center htw:justify-center htw:w-4 htw:h-4 htw:data-[status=failed]:text-danger htw:data-[status=passed]:text-accent" :data-status="item.status" role="img" :aria-label="GROUP_STATUS[item.status].label" :title="GROUP_STATUS[item.status].label">
            <BuiltinIcon v-if="GROUP_STATUS[item.status].icon" :icon="GROUP_STATUS[item.status].icon!" :size="16" />
            <HstPulsatingDisc v-else :size="14" />
          </span>
          <strong class="htw:flex-1 htw:overflow-hidden htw:whitespace-nowrap htw:text-ellipsis htw:font-[750]">{{ item.title }}</strong>
          <span class="htw:text-[11px] htw:font-mono htw:text-muted">{{ item.count }} / {{ item.total }}</span>
        </HstButton>
        <TestsTreeRow v-else :row="item.row" :selected="selected?.storyId === item.row.target.storyId && selected?.variantId === item.row.target.variantId" @select="emit('select', $event)" />
      </template>
    </WorkbenchVirtualList>
  </div>
</template>
