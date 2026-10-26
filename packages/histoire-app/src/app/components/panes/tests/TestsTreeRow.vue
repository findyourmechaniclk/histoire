<script setup lang="ts">
import type { WorkbenchTestRow } from './types.js'
import { BuiltinIcon, HstButton, HstPulsatingDisc } from '@histoire/controls/vue'
import { getHistoireTargetKey } from '@histoire/protocol'
import { computed } from 'vue'
import { isContextMenuShortcut, useContextMenu } from '../../../composables/context-menu.js'

/** One actual collected variant or diagnostic; unknown diagnostics stay visible. */
const props = defineProps<{ row: WorkbenchTestRow, selected: boolean }>()
const emit = defineEmits<{ select: [row: WorkbenchTestRow] }>()
const menu = useContextMenu()
/** Collection warnings retain priority over an active test operation. */
const running = computed(() => !props.row.notCollected && props.row.running)
const icon = computed(() => props.row.notCollected ? 'warning-alt-filled' : props.row.stale ? 'renew' : props.row.failed ? 'error-filled' : props.row.summary?.passed ? 'checkmark-filled' : 'subtract')
const status = computed(() => props.row.notCollected ? 'not collected' : props.row.stale ? 'outdated' : props.row.running ? 'running' : props.row.failed ? 'tests failing' : props.row.summary ? 'tests completed' : 'not run')

/** Project test menu keeps exact target when current selection differs. */
function openMenu(event: MouseEvent | KeyboardEvent): void {
  if (!props.row.selectable || !props.row.target.variantId) return
  const target = props.row.target
  menu?.open(event, {
    kind: 'test',
    key: props.row.key,
    label: `${props.row.storyTitle} › ${props.row.variantTitle ?? target.variantId}`,
    selection: target,
    frame: { storyId: target.storyId, variantId: target.variantId, frameKey: getHistoireTargetKey(target) },
  }, ['context.copy-link'])
}

/** Expose test-row actions with ContextMenu and Shift+F10. */
function onKeydown(event: KeyboardEvent): void {
  if (isContextMenuShortcut(event)) openMenu(event)
}
</script>

<template>
  <HstButton color="flat" type="button" class="test-row htw:flex htw:items-center htw:gap-2 htw:w-full htw:h-[var(--histoire-virtual-row-height,_39px)] htw:py-row-test htw:pr-2.5 htw:pl-10.5 htw:text-text htw:leading-4.5 htw:text-left htw:hover:bg-accent-soft htw:aria-[current=true]:bg-accent-soft htw:focus-visible:[outline:2px_solid_var(--histoire-accent)] htw:focus-visible:outline-offset-[-2px] htw:disabled:opacity-[1] htw:disabled:[cursor:default]" :aria-current="selected ? 'true' : undefined" :aria-label="`${row.storyTitle} / ${row.variantTitle ?? status}, ${status}`" :disabled="!row.selectable" :title="row.error ? String(row.error) : undefined" @click="emit('select', row)" @contextmenu="openMenu" @keydown="onKeydown">
    <HstPulsatingDisc v-if="running" class="htw:text-muted" />
    <BuiltinIcon v-else :class="!row.failed && row.summary?.passed ? 'htw:text-accent' : row.notCollected ? 'htw:text-warn' : row.failed ? 'htw:text-danger' : undefined" :icon="icon" :size="16" />
    <span class="htw:flex-1 htw:overflow-hidden htw:whitespace-nowrap htw:text-ellipsis">{{ row.variantTitle ?? row.storyTitle }}</span>
    <span v-if="row.notCollected" class="htw:text-muted htw:font-mono htw:text-[11px] htw:whitespace-nowrap">not collected</span>
    <span v-else-if="row.stale" class="htw:text-muted htw:font-mono htw:text-[11px] htw:whitespace-nowrap">outdated</span>
    <span v-else-if="row.duration !== null" class="htw:text-muted htw:font-mono htw:text-[11px] htw:whitespace-nowrap">{{ Math.round(row.duration) }}ms</span>
  </HstButton>
</template>
