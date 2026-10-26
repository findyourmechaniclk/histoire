<script setup lang="ts">
import type { QualifiedContribution } from '@histoire/plugin-kit'
import type { HistoireSession } from '@histoire/sdk'
import type { BuiltinInspectorTabValue, InspectorTab, InspectorTabItem } from './state.js'
import { getHistoireTargetKey } from '@histoire/protocol'
import { useHistoireContext } from '@histoire/vue/internal'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { isContextMenuShortcut, useContextMenu } from '../../composables/context-menu.js'
import { useSelection } from '../../composables/selection.js'
import { resolveContributionIcon } from '../../extensions/icons.js'
import WorkbenchEmptyState from '../shell/WorkbenchEmptyState.vue'
import WorkbenchLoadingState from '../shell/WorkbenchLoadingState.vue'
import { INSPECTOR_BUILTIN_VIEWS } from './builtins.js'
import InspectorExtensionOutlet from './InspectorExtensionOutlet.vue'
import InspectorHeader from './InspectorHeader.vue'
import InspectorTabs from './InspectorTabs.vue'
import { provideInspectorModel, useInspectorTestsState } from './model.js'
import { useInspectorExtensions } from './plugin-tabs.js'
import SourceDrawer from './SourceDrawer.vue'
import { createInspectorEventCounter, getInspectorTabId, getInspectorTabKey, getInspectorTabs, isInspectorTestsEnabled, resolveInspectorTab } from './state.js'

const props = defineProps<{
  /** Route tab value supplied by standalone routing adapter: built-in value or plugin tab id. */
  activeTab?: string
  /** Current documentation anchor supplied by standalone adapter. */
  docsAnchor?: string
  /** Explicit isolated-preview URL built by standalone adapter. */
  isolatedHref?: string
  /** Matrix layout may name local props selection without changing canonical variant. */
  variantTitle?: string
  /** Root workbench session retaining project-wide test aggregation. */
  projectTestSession?: HistoireSession
}>()
const emit = defineEmits<{ panel: [value: InspectorTab], close: [], error: [error: unknown] }>()
const { session, snapshot, story, variant } = useSelection()
const context = useHistoireContext()
const menu = useContextMenu()
const id = useId()
const root = ref<HTMLElement>()
const extensions = useInspectorExtensions(snapshot)
const tests = useInspectorTestsState(session, snapshot, props.projectTestSession)
const testsEnabled = computed(() => isInspectorTestsEnabled(__HISTOIRE_DEV__, snapshot.value.source?.mode))
const resolution = computed(() => resolveInspectorTab(props.activeTab ?? '', { testsEnabled: testsEnabled.value, pluginTabs: extensions.tabs.value.map(tab => tab.id), ready: extensions.ready.value }))
const active = computed(() => resolution.value.value)
/** Built-in views of the active tab; `undefined` for plugin tabs. */
const builtin = computed(() => Object.hasOwn(INSPECTOR_BUILTIN_VIEWS, active.value) ? INSPECTOR_BUILTIN_VIEWS[active.value as BuiltinInspectorTabValue] : undefined)
/** Qualified id of the active tab; sections attach to it. */
const activeId = computed(() => getInspectorTabId(active.value))
const panelKey = computed(() => getInspectorTabKey(active.value))
const tabs = computed((): InspectorTabItem[] => [
  ...getInspectorTabs(testsEnabled.value).map(tab => ({ value: tab.value, label: tab.label, badge: INSPECTOR_BUILTIN_VIEWS[tab.value].badge })),
  ...extensions.tabs.value.map(tab => ({ value: tab.id, label: tab.label, icon: resolveContributionIcon(tab), badgeText: extensions.badgeOf(tab), overflow: true })),
])
/** A selected variant whose frame is not admitted yet: plugin views wait for it. */
const frameLoading = computed(() => snapshot.value.status === 'ready' && Boolean(snapshot.value.selection?.variantId) && !snapshot.value.stale && snapshot.value.runtime.status !== 'failed')

const unseen = ref(0)
const counter = createInspectorEventCounter()
const events = computed(() => snapshot.value.events.items.filter(event => event.runtimeId === snapshot.value.runtime.runtimeId && event.target.storyId === snapshot.value.selection?.storyId && event.target.variantId === snapshot.value.selection?.variantId))
provideInspectorModel({ docsAnchor: computed(() => props.docsAnchor), events, unseen, tests })
watch([snapshot, active], () => unseen.value = counter.observe(snapshot.value, active.value === 'events'), { immediate: true, flush: 'sync' })
watch(() => context.panels.docs.value, intent => intent && emit('panel', 'docs'))

// A plugin tab named by the route disappeared after setup settled (removed, unavailable or
// unknown): rewrite the route to Props. Runs before the DOM update so it can tell whether the
// removed tab held focus, then moves focus to the Props tab instead of losing it to the body.
watch(() => resolution.value.rewrite, (rewrite) => {
  if (!rewrite) return
  const focused = typeof document !== 'undefined' && Boolean(root.value?.contains(document.activeElement))
  emit('panel', active.value)
  if (focused) void nextTick(() => document.getElementById(`${id}-tab-${getInspectorTabKey('')}`)?.focus())
})

/**
 * Section placement filter.
 * @param tab Qualified tab id or `footer`.
 * @param position Placement around the tab body.
 */
function placement(tab: string, position?: 'before' | 'after') {
  return (contribution: QualifiedContribution) => contribution.kind === 'inspector.section' && contribution.tab === tab && (!position || contribution.position === position)
}
const isBefore = computed(() => placement(activeId.value, 'before'))
const isAfter = computed(() => placement(activeId.value, 'after'))
const isFooter = placement('footer')
const isActiveTab = computed(() => (contribution: QualifiedContribution) => contribution.id === active.value)

/** Explicit tab choice retires local search intent, while route mutation stays in host. */
function select(value: InspectorTab) {
  context.panels.clear()
  emit('panel', value)
}

/** Inspector target menus reuse exact frame capabilities for selected variants. */
function openSelectionMenu(event: MouseEvent | KeyboardEvent): void {
  const target = snapshot.value.selection
  if (!target || !menu) return
  const frame = target.variantId ? { storyId: target.storyId, variantId: target.variantId, frameKey: getHistoireTargetKey(target) } : undefined
  const variantTitle = target.variantId ? story.value?.variants.find(item => item.id === target.variantId)?.title : undefined
  menu.open(event, { kind: 'inspector', label: `${story.value?.title ?? target.storyId}${variantTitle ? ` › ${variantTitle}` : ''}`, selection: target, frame }, ['context.copy-link'])
}

/** Prop and state rows expose only their supported reset/copy operations. */
function openControlMenu(event: MouseEvent | KeyboardEvent): void {
  if ('key' in event && !isContextMenuShortcut(event)) return
  if (typeof Element === 'undefined' || !(event.target instanceof Element) || !menu) return
  const element = event.target.closest<HTMLElement>('.histoire-prop-control, .histoire-state-control')
  if (!element) {
    openSelectionMenu(event)
    return
  }
  const controlKind = element.classList.contains('histoire-prop-control') ? 'prop' : 'state'
  const label = element.getAttribute('title')?.replace(/ \*$/, '') || element.getAttribute('aria-label') || 'Control'
  const resetElement = controlKind === 'prop'
    ? element.querySelector<HTMLButtonElement>('.histoire-prop-control-reset') ?? undefined
    : element.closest('.histoire-controls')?.querySelector<HTMLButtonElement>('.histoire-controls-reset') ?? undefined
  const actions = ['control.copy-name', controlKind === 'prop' ? 'control.reset-override' : 'control.reset-state']
  menu.open(event, { kind: 'control', key: `${controlKind}:${label}`, label, controlKind, element, resetElement }, actions)
}
</script>

<template>
  <section ref="root" class="htw:flex htw:flex-col htw:w-full htw:h-full htw:min-w-0 htw:min-h-0 htw:overflow-hidden htw:[border:1px_solid_transparent] htw:rounded-panel htw:text-text htw:bg-surface htw:[&[data-active-tab='docs']]:border-border htw:[&[data-active-tab='docs']]:bg-canvas" :data-active-tab="active || 'props'" data-test-id="story-side-panel" aria-label="Story inspector">
    <InspectorHeader :story-title="story?.title || 'Story'" :variant-title="variantTitle || variant?.title" :isolated-href="isolatedHref" @close="emit('close')" @contextmenu="openSelectionMenu" />
    <InspectorTabs :id-prefix="id" :active-tab="resolution.pending ? undefined : active" :tabs="tabs" @select="select" />
    <div :id="`${id}-panel-${panelKey}`" class="htw:flex-1 htw:min-h-0 htw:overflow-auto" data-histoire-docs-scroll role="tabpanel" :aria-labelledby="resolution.pending ? undefined : `${id}-tab-${panelKey}`" :aria-busy="resolution.pending || undefined" @contextmenu="openControlMenu" @keydown="openControlMenu">
      <WorkbenchLoadingState v-if="resolution.pending" title="Loading extensions" />
      <template v-else>
        <InspectorExtensionOutlet v-if="extensions.frame.value" kind="inspector.section" :context="extensions.frame.value" :filter="isBefore" />
        <component :is="builtin.component" v-if="builtin" @error="emit('error', $event)">
          <template v-if="!active && ($slots['matrix-props'] || $slots.matrix)" #matrix>
            <slot name="matrix-props">
              <slot name="matrix" />
            </slot>
          </template>
        </component>
        <InspectorExtensionOutlet v-else-if="extensions.frame.value" kind="inspector.tab" :context="extensions.frame.value" :filter="isActiveTab" />
        <WorkbenchLoadingState v-else-if="frameLoading" title="Loading variant" />
        <WorkbenchEmptyState v-else icon="cursor-1" title="Select a variant" />
        <InspectorExtensionOutlet v-if="extensions.frame.value" kind="inspector.section" :context="extensions.frame.value" :filter="isAfter" />
      </template>
    </div>
    <InspectorExtensionOutlet v-if="extensions.frame.value" kind="inspector.section" :context="extensions.frame.value" :filter="isFooter" footer />
    <SourceDrawer :tone="active === 'docs' ? 'surface' : undefined" @error="emit('error', $event)" @contextmenu="openSelectionMenu" />
  </section>
</template>
