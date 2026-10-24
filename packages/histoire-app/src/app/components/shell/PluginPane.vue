<script setup lang="ts">
import type { QualifiedContribution, WorkbenchContext } from '@histoire/plugin-kit'
import { contributionKey } from '../../extensions/shell-registry.js'
import ExtensionView from '../extensions/ExtensionView.vue'
import WorkbenchLoadingState from './WorkbenchLoadingState.vue'
import WorkbenchPaneHeader from './WorkbenchPaneHeader.vue'

defineProps<{
  /** Plugin pane to render; absent while plugin setup has not settled. */
  pane?: QualifiedContribution<'shell.pane'>
  /** Root workbench context handed to the view. */
  context?: WorkbenchContext
}>()
</script>

<template>
  <template v-if="pane && context">
    <WorkbenchPaneHeader :title="pane.label" />
    <ExtensionView :key="contributionKey(pane)" class="histoire-plugin-pane-body" :contribution="pane" :context="context" />
  </template>
  <WorkbenchLoadingState v-else title="Loading pane" />
</template>

<style scoped>
/* Column like built-in panes: a plugin view rendering `WorkbenchPaneToolbar` + `WorkbenchPaneList` as its roots keeps the toolbar fixed while the list scrolls. */
.histoire-plugin-pane-body { display: flex; flex: 1; flex-direction: column; min-height: 0; overflow: auto; }
</style>
