<script setup lang="ts">
import type { FrameScopedContext } from '@histoire/plugin-kit'
import type { ReferenceModel } from '../domain/model.js'
import { HstButton, HstPulsatingDisc } from '@histoire/controls/vue'
import { WorkbenchEmptyState } from '@histoire/plugin-kit/vue'
import { diagnosticsState } from '../domain/view-state.js'
import { useViewState } from './use-view-state.js'

const props = defineProps<{
  /** Frame-scoped context of the selected frame. */
  context: FrameScopedContext
  /** Plugin state. */
  model: ReferenceModel
}>()
const state = useViewState(props.model, () => diagnosticsState(props.model, props.context))
</script>

<template>
  <div class="hst-ref-panel">
    <div class="hst-ref-row">
      <HstPulsatingDisc v-if="!state.ready" :size="12" />
      <span class="hst-ref-grow">{{ state.status }}</span>
      <HstButton @click="model.audits.rerun(state.frameKey)">
        Run again
      </HstButton>
    </div>
    <WorkbenchEmptyState v-if="state.ready && !state.issues.length" icon="checkmark" title="No issues" />
    <ul v-else class="hst-ref-list">
      <li v-for="issue in state.issues" :key="issue.index">
        <button type="button" class="hst-ref-item" title="Highlight in frame" @click="model.audits.highlight(state.frameKey, issue.index)">
          <span class="hst-ref-chip" data-tone="warn">{{ issue.rule }}</span>
          <span class="hst-ref-grow">{{ issue.element }}</span>
          <span class="hst-ref-muted">{{ issue.message }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
