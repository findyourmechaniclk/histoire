<script setup lang="ts">
import type { WorkbenchContext } from '@histoire/plugin-kit'
import type { ReferenceModel } from '../domain/model.js'
import { HstButton, HstSwitch } from '@histoire/controls/vue'
import { settingsState } from '../domain/view-state.js'
import { useViewState } from './use-view-state.js'

const props = defineProps<{
  /** Root context. */
  context: WorkbenchContext
  /** Plugin state. */
  model: ReferenceModel
}>()
const state = useViewState(props.model, () => settingsState(props.model))
</script>

<template>
  <div class="hst-ref-panel">
    <HstSwitch title="Issue badges" :model-value="state.badges" @update:model-value="model.preferences.setBadges($event)" />
    <div class="hst-ref-row">
      <span class="hst-ref-grow">Annotations: {{ state.annotations }}</span>
      <HstButton :disabled="!state.annotations" @click="model.preferences.clearAnnotations()">
        Clear
      </HstButton>
    </div>
    <div class="hst-ref-muted">
      Minimum target size: {{ state.minTargetSize }} px
    </div>
  </div>
</template>
