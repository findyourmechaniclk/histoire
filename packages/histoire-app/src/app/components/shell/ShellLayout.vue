<script setup lang="ts">
import type { ShellPane } from '../../stores/shell.js'
import { HstButton } from '@histoire/controls/vue'
import { useHistoireContext, useHistoireResource } from '@histoire/vue/internal'
import { computed, onMounted, useId, watch } from 'vue'
import { useContributionLookup } from '../../composables/shell-extensions.js'
import { useShell } from '../../composables/shell.js'
import { isPluginContributionId } from '../../extensions/shell-registry.js'
import AppRail from './AppRail.vue'
import InspectorFrame from './InspectorFrame.vue'
import { watchDismissedPanelFocus } from './panel-focus.js'
import PluginPane from './PluginPane.vue'
import SidePanelHost from './SidePanelHost.vue'
import '../../style/density.css'

const props = defineProps<{
  /** Home href resolved by explicit standalone navigation adapter. */
  homeHref: string
  /** Active Home route, independent of side-panel selection and visibility. */
  homeActive?: boolean
  /** Optional project logo hyperlink. */
  logoHref?: string
  /** Existing resolved project logo assets. */
  logos?: { square?: string, light?: string, dark?: string }
  /** Settings navigation is enabled only after route registration. */
  settingsAvailable?: boolean
  /** Active settings route, used by its rail affordance. */
  settingsActive?: boolean
  /** Existing theme visibility option. */
  hideTheme?: boolean
  /** Story routes decide whether inspector is applicable. */
  showInspector?: boolean
  /** Caller-provided dev status counts. */
  badges?: Partial<Record<ShellPane, number>>
}>()
const emit = defineEmits<{ home: [], pane: [pane: Exclude<ShellPane, 'home'>], settings: [], error: [error: unknown] }>()
const shell = useShell()
const context = useHistoireContext()
const panelId = `histoire-side-panel-${useId()}`
const inspectorId = `histoire-inspector-${useId()}`
// Plugin panes come from the workbench registry; the shell keeps a restored plugin pane while
// setup is pending and recovers to Stories once it is known not to appear.
const panes = useContributionLookup('shell.pane')
const unbindPanes = shell.bindPanes(panes)
/** Plugin pane currently selected, when registered and available. */
const pluginPane = computed(() => isPluginContributionId(shell.pane.value) ? panes.list().find(pane => pane.id === shell.pane.value) : undefined)
/** Accessible name of the side panel region. */
const paneLabel = computed(() => isPluginContributionId(shell.pane.value) ? pluginPane.value?.label ?? 'Extension' : shell.pane.value === 'ai' ? 'AI' : shell.pane.value)
const stopSize = watch(() => context.size.value.width, shell.setNarrow, { immediate: true })
const stopInspector = watch(() => !!props.showInspector, shell.setInspectorAvailable, { immediate: true })
const stopPanelFocus = watchDismissedPanelFocus({
  getRoot: () => context.root.value,
  isOpen: () => shell.panelOpen.value && shell.pane.value !== 'home',
  getDestination: () => context.root.value?.querySelector<HTMLElement>(`[data-shell-pane="${shell.pane.value}"]`) ?? null,
})
let selection = JSON.stringify(context.session.getSnapshot().selection)
const stopSelection = context.session.subscribe((value) => {
  // Search owns dismissal after its Docs route/anchor finishes. Other panes
  // can dismiss on selection; unrelated publications never close a panel.
  const key = JSON.stringify(value.selection)
  if (selection !== key) {
    selection = key
    if (value.selection && shell.pane.value !== 'search') shell.closePanelAfterSelection()
  }
})
onMounted(() => {
  try {
    const storage = context.root.value?.ownerDocument.defaultView?.localStorage
    if (storage) shell.restore(storage)
  }
  catch { /* Restricted browser storage leaves usable in-memory preferences. */ }
})
useHistoireResource(() => {
  unbindPanes()
  stopSize()
  stopInspector()
  stopPanelFocus()
  stopSelection()
})
</script>

<template>
  <div class="histoire-shell-layout htw:grid htw:grid-cols-[56px_minmax(0,1fr)] htw:w-full htw:min-w-0 htw:min-h-0 htw:h-full htw:text-text htw:bg-canvas htw:font-sans htw:text-[13px] htw:data-[panel-open=true]:grid-cols-[56px_var(--histoire-panel-width,280px)_minmax(0,1fr)] htw:data-[ui-hidden=true]:grid-cols-[minmax(0,1fr)] htw:data-[ui-hidden=true]:grid-rows-[minmax(0,1fr)] htw:[@container(max-width:640px)]:grid-cols-[minmax(0,1fr)] htw:[@container(max-width:640px)]:grid-rows-[minmax(0,1fr)_56px] htw:[@container(max-width:640px)]:data-[panel-open=true]:grid-cols-[minmax(0,1fr)] htw:[@container(max-width:640px)]:data-[ui-hidden=true]:grid-rows-[minmax(0,1fr)]" :data-panel-open="shell.panelOpen.value && shell.pane.value !== 'home'" :data-ui-hidden="shell.uiHidden.value" :style="{ '--histoire-panel-width': `${shell.panelWidth.value}px` }">
    <AppRail v-if="!shell.uiHidden.value" class="htw:[@container(max-width:640px)]:row-start-2 htw:[@container(max-width:640px)]:z-90" :panel-id="panelId" :home-href="homeHref" :home-active="homeActive" :logo-href="logoHref" :logos="logos" :settings-available="settingsAvailable" :settings-active="settingsActive" :hide-theme="hideTheme" :badges="badges" @home="emit('home')" @pane="emit('pane', $event)" @settings="emit('settings')" @error="emit('error', $event)" />
    <HstButton v-if="!shell.uiHidden.value && shell.narrow.value && shell.panelOpen.value && shell.pane.value !== 'home'" color="flat" class="htw:absolute htw:top-0 htw:inset-x-0 htw:bottom-14 htw:z-70 htw:p-0" type="button" aria-label="Close side panel" @click="shell.togglePanel" />
    <SidePanelHost v-if="!shell.uiHidden.value && shell.panelOpen.value && shell.pane.value !== 'home'" :id="panelId" :pane="shell.pane.value" :label="paneLabel">
      <slot :name="shell.pane.value">
        <PluginPane v-if="isPluginContributionId(shell.pane.value)" :pane="pluginPane" :context="panes.workbench?.context" />
      </slot>
    </SidePanelHost>
    <main class="htw:flex htw:flex-col htw:relative htw:min-w-0 htw:min-h-0 htw:overflow-hidden htw:[@container(max-width:640px)]:row-start-1">
      <slot name="main">
        <slot />
      </slot>
      <InspectorFrame v-if="!shell.uiHidden.value && showInspector && shell.inspectorOpen.value && $slots.inspector" :id="inspectorId" @close="shell.toggleInspector">
        <template v-if="$slots['inspector-header']" #header>
          <slot name="inspector-header" />
        </template>
        <slot name="inspector" />
      </InspectorFrame>
      <slot v-if="!shell.uiHidden.value" name="overlays" />
    </main>
  </div>
</template>
