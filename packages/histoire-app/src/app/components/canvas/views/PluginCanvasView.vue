<script setup lang="ts">
import type { CanvasViewContext } from '@histoire/plugin-kit'
import type { WorkbenchHost } from '../../../extensions/create-workbench-host.js'
import type { ContributionPresence } from '../../../extensions/shell-registry.js'
import type { CanvasViewContribution } from './canvas-views.js'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { contributionKey } from '../../../extensions/shell-registry.js'
import ExtensionView from '../../extensions/ExtensionView.vue'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'
import WorkbenchErrorState from '../../shell/WorkbenchErrorState.vue'
import WorkbenchLoadingState from '../../shell/WorkbenchLoadingState.vue'

defineProps<{
  /** Registered view; absent while pending or once missing. */
  view?: CanvasViewContribution
  /** Registry presence of the requested view. */
  presence: ContributionPresence
  /** Canvas-scoped context owned by this view (see `useCanvasViewContext`). */
  context?: CanvasViewContext
  /** Extension host rendering the view. */
  workbench?: WorkbenchHost
}>()

/**
 * Message of a view failure.
 * @param error Failure reported by the view.
 */
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <div class="histoire-canvas-plugin-view">
    <!-- Content root: presses inside belong to the view (see `views/view-input.ts`). -->
    <ExtensionView v-if="view && context && workbench" :key="contributionKey(view)" class="histoire-canvas-plugin-view-body" data-histoire-canvas-view :contribution="view" :context="context" :host="workbench.host">
      <template #error="{ error }">
        <WorkbenchErrorState :title="`${view.label} failed`">
          {{ message(error) }}
          <template #actions>
            <HstButton color="flat" type="button" @pointerdown.stop @click="workbench.context.navigation.openCanvasView('builtin:grid')">
              <BuiltinIcon icon="grid" :size="16" />
              Switch to Grid
            </HstButton>
          </template>
        </WorkbenchErrorState>
      </template>
    </ExtensionView>
    <WorkbenchLoadingState v-else-if="presence === 'pending'" title="Loading view" />
    <WorkbenchEmptyState v-else icon="view" title="View unavailable">
      <template v-if="workbench" #actions>
        <HstButton color="flat" type="button" @pointerdown.stop @click="workbench.context.navigation.openCanvasView('builtin:grid')">
          <BuiltinIcon icon="grid" :size="16" />
          Switch to Grid
        </HstButton>
      </template>
    </WorkbenchEmptyState>
  </div>
</template>

<style scoped>
/* The view covers the canvas body in viewport pixels; it places content through canvas transforms. */
.histoire-canvas-plugin-view { position: absolute; inset: 0; display: grid; place-items: center; }
.histoire-canvas-plugin-view-body { position: absolute; inset: 0; display: grid; place-items: center; }
.histoire-canvas-plugin-view-body :deep(.histoire-extension-mount) { position: absolute; inset: 0; }
</style>
