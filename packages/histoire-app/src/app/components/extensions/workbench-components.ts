import type { WorkbenchComponents } from '@histoire/plugin-kit'
import WorkbenchEmptyState from '../shell/WorkbenchEmptyState.vue'
import WorkbenchErrorState from '../shell/WorkbenchErrorState.vue'
import WorkbenchLoadingState from '../shell/WorkbenchLoadingState.vue'
import WorkbenchPaneHeader from '../shell/WorkbenchPaneHeader.vue'
import WorkbenchPaneList from '../shell/WorkbenchPaneList.vue'
import WorkbenchPaneToolbar from '../shell/WorkbenchPaneToolbar.vue'

/**
 * Standalone workbench implementations of the components plugin-kit `/vue` exports, handed to
 * every plugin view by `ExtensionView.vue` (Vue views by injection, DOM views through
 * `ViewHost.renderState`).
 */
export const workbenchComponents: Readonly<WorkbenchComponents> = Object.freeze({
  WorkbenchEmptyState,
  WorkbenchLoadingState,
  WorkbenchErrorState,
  WorkbenchPaneHeader,
  WorkbenchPaneToolbar,
  WorkbenchPaneList,
})
