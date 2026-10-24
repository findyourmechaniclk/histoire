<script setup lang="ts">
import type { FrameScopedContext } from '@histoire/plugin-kit'
import type { ReferenceModel } from '../domain/model.js'
import { HstButton } from '@histoire/controls/vue'
import { useWorkbenchContext } from '@histoire/plugin-kit/vue'
import { diagnosticsState } from '../domain/view-state.js'
import { AUDIT_TAB_ID } from '../workbench/views.js'
import { useViewState } from './use-view-state.js'

// The wrapper also passes `context`; this view reads it through `useWorkbenchContext()` instead.
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  /** Plugin state. */
  model: ReferenceModel
}>()
// Same context as the `context` prop, readable at any depth below a workbench view.
const context = useWorkbenchContext<FrameScopedContext>()
const state = useViewState(props.model, () => diagnosticsState(props.model, context))
</script>

<template>
  <div class="hst-ref-panel" data-flush>
    <div class="hst-ref-row">
      <span class="hst-ref-grow">{{ state.status }}</span>
      <HstButton @click="context.navigation.openInspectorTab(AUDIT_TAB_ID)">
        Open audit
      </HstButton>
    </div>
  </div>
</template>
