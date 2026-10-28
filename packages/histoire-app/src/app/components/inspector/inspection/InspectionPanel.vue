<script setup lang="ts">
import type { HistoireSession } from '@histoire/sdk'
import type { InspectionPick } from './picker.js'
import { HstButton, HstPulsatingDisc, useLoadingDelay } from '@histoire/controls/vue'
import { sameInspectionOwner } from '@histoire/protocol'
import { useHistoireSession } from '@histoire/vue'
import { ref, watch } from 'vue'
import { useOptionalExtensionHost } from '../../../composables/extensions.js'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'
import WorkbenchErrorState from '../../shell/WorkbenchErrorState.vue'
import WorkbenchLoadingState from '../../shell/WorkbenchLoadingState.vue'
import WorkbenchPaneHeader from '../../shell/WorkbenchPaneHeader.vue'
import WorkbenchPanelAction from '../../shell/WorkbenchPanelAction.vue'
import InspectionAccessibility from './InspectionAccessibility.vue'
import InspectionComponents from './InspectionComponents.vue'
import { useInspection } from './use-inspection.js'

const props = defineProps<{
  /** Last pick owned by the current frame. */
  picked?: InspectionPick
  /** Canonical source grants constrain the selected actor. */
  sourceSession?: HistoireSession
}>()
const { capture, available, variantAvailable, domAvailable, componentsAvailable, componentDetailsAvailable, auditAvailable, pickAvailable, highlightAvailable, result, domResult, components, component, audit, lease, error, running, operationLabel, clearDom, readState, readDom, readComponents, readComponent, runAudit, highlight, clearHighlight } = useInspection(useHistoireSession(), useOptionalExtensionHost(), props.sourceSession)
const inlineLoadingVisible = useLoadingDelay(() => running.value && !!(result.value || domResult.value || components.value || audit.value))
const selector = ref('')
const pickMessage = ref<string>()
const pickFailed = ref(false)
watch(() => props.picked, (picked) => {
  const owner = capture()
  if (!picked || !owner || picked.frameKey !== owner.frame.context.frame.key || !sameInspectionOwner(picked.owner, owner.owner)) return
  pickMessage.value = picked.message
  if (!picked.failed && lease.value) void clearHighlight()
  pickFailed.value = picked.failed === true
  if (picked.selector) {
    selector.value = picked.selector
    if (domAvailable.value) void readDom(picked.selector)
  }
  else if (!picked.failed) {
    selector.value = ''
    clearDom()
  }
}, { immediate: true })
</script>

<template>
  <section class="htw:flex htw:flex-col htw:min-h-0">
    <WorkbenchPaneHeader title="Inspection">
      <WorkbenchPanelAction v-if="variantAvailable" icon="renew" label="Read state" :disabled="running" @click="readState" />
    </WorkbenchPaneHeader>
    <WorkbenchEmptyState v-if="!available" icon="information" title="Inspection unavailable" />
    <template v-else>
      <p v-if="pickMessage" :role="pickFailed ? 'alert' : 'status'" class="htw:px-pane-gutter htw:text-muted">
        {{ pickMessage }}
      </p>
      <div v-if="domAvailable || highlightAvailable || pickAvailable" class="htw:flex htw:items-end htw:gap-2 htw:px-pane-gutter htw:pb-pane-gutter">
        <label class="htw:flex htw:flex-col htw:flex-1 htw:gap-1">
          <span>CSS selector</span>
          <input v-model="selector" type="text" class="htw:min-w-0 htw:bg-surface htw:text-text" placeholder="Story root" @keydown.enter.prevent="!running && readDom(selector.trim() || undefined)">
        </label>
        <HstButton v-if="domAvailable" color="flat" type="button" :disabled="running" @click="readDom(selector.trim() || undefined)">
          Read DOM
        </HstButton>
        <HstButton v-if="highlightAvailable && !lease" color="flat" type="button" :disabled="running || !selector.trim()" @click="highlight(selector.trim())">
          Highlight
        </HstButton>
        <HstButton v-else-if="highlightAvailable" color="flat" type="button" :disabled="running" @click="clearHighlight">
          Clear highlight
        </HstButton>
      </div>
      <div v-if="componentsAvailable" class="htw:px-pane-gutter htw:pb-pane-gutter">
        <HstButton color="flat" type="button" :disabled="running" @click="readComponents">
          Read components
        </HstButton>
      </div>
      <div v-if="auditAvailable" class="htw:px-pane-gutter htw:pb-pane-gutter">
        <WorkbenchPanelAction icon="checkmark" label="Run audit" :disabled="running" @click="runAudit" />
      </div>
      <WorkbenchLoadingState v-if="running && !result && !domResult && !components && !audit" :title="`Reading ${operationLabel}`" />
      <WorkbenchEmptyState v-else-if="!result && !domResult && !components && !audit && !error" icon="search" :title="variantAvailable ? 'Read current state' : domAvailable ? 'Inspect current DOM' : componentsAvailable ? 'Read components' : auditAvailable ? 'Run audit' : 'Pick an element'" />
      <div v-if="inlineLoadingVisible" role="status" class="htw:flex htw:items-center htw:gap-2 htw:px-pane-gutter htw:text-muted">
        <HstPulsatingDisc immediate :size="12" /> Reading {{ operationLabel }}
      </div>
      <section v-if="result" aria-label="State">
        <h3 class="htw:px-pane-gutter htw:text-text">
          State
        </h3>
        <pre class="htw:m-0 htw:px-pane-gutter htw:pb-pane-gutter htw:overflow-auto htw:text-body htw:whitespace-pre-wrap">{{ JSON.stringify(result.state, null, 2) }}</pre>
      </section>
      <WorkbenchEmptyState v-if="domResult && !domResult.matched" icon="search" title="No matching element" />
      <section v-else-if="domResult" aria-label="DOM">
        <h3 class="htw:px-pane-gutter htw:text-text">
          DOM
        </h3>
        <pre class="htw:m-0 htw:px-pane-gutter htw:pb-pane-gutter htw:overflow-auto htw:text-body htw:whitespace-pre-wrap">{{ JSON.stringify(domResult.nodes, null, 2) }}</pre>
      </section>
      <InspectionComponents v-if="components" :tree="components" :details="component" :can-read-details="componentDetailsAvailable" :running="running" @select="readComponent" />
      <InspectionAccessibility v-if="audit" :audit="audit" />
      <p v-if="error && (result || domResult || components || audit)" role="alert" class="htw:mx-pane-gutter htw:text-danger-text">
        {{ error }}
      </p>
      <WorkbenchErrorState v-else-if="error" :title="`Could not read ${operationLabel}`">
        {{ error }}
      </WorkbenchErrorState>
    </template>
  </section>
</template>
