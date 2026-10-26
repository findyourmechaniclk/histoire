<script setup lang="ts">
import type { ExtensionHost, QualifiedContribution } from '@histoire/plugin-kit'
import type { HistoirePartClasses } from '@histoire/vue'
import { WORKBENCH_COMPONENTS_KEY } from '@histoire/plugin-kit'
import { mergePartClass, useExtensionView } from '@histoire/vue/internal'
import { computed, provide, ref } from 'vue'
import { useExtensionHost } from '../../composables/extensions.js'
import WorkbenchErrorState from '../shell/WorkbenchErrorState.vue'
import WorkbenchLoadingState from '../shell/WorkbenchLoadingState.vue'
import { workbenchComponents } from './workbench-components.js'

const props = withDefaults(defineProps<{
  /** Host utilities for the view root and DOM mount container. */
  classes?: HistoirePartClasses<'root' | 'mount'>
  /** Explicit false makes the view inert; omission preserves host pointer behavior. */
  interactive?: boolean
  /**
   * View-bearing contribution. Fixed for the component's lifetime: key the component by
   * contribution so a re-registered contribution remounts.
   */
  contribution: QualifiedContribution
  /** Surface context snapshot; new snapshots update the view without remounting it. */
  context: unknown
  /** Extension host; defaults to the nearest workbench's host. */
  host?: ExtensionHost
}>(), { interactive: undefined })
defineSlots<{
  /** Replaces the loading state shown while a DOM view mounts. */
  pending?: () => any
  /** Replaces the error state shown after the view failed. */
  error?: (props: { error: unknown }) => any
}>()

/** Elements carrying the workbench theme tokens (see `style/tokens.pcss`). */
const THEME_SCOPE_SELECTOR = '.histoire-app, .histoire-workbench, .histoire-root'

const root = ref<HTMLElement>()
// Plugin views use the workbench's own state and pane components (plugin-kit `/vue` exports).
provide(WORKBENCH_COMPONENTS_KEY, workbenchComponents)
const { id } = props.contribution
// Same lifecycle as native providers' views; only the rendered states differ.
const { name, component: viewComponent, current, failure, pending, container, onComponentMounted } = useExtensionView({
  host: props.host ?? useExtensionHost().host,
  contribution: props.contribution,
  context: () => props.context,
  components: workbenchComponents,
  // Plugin popovers sit inside the nearest workbench theme scope so they inherit its variables.
  overlayParent: () => root.value && (root.value.closest<HTMLElement>(THEME_SCOPE_SELECTOR) ?? document.body),
})
const errorMessage = computed(() => failure.value?.error instanceof Error ? failure.value.error.message : String(failure.value?.error ?? ''))
</script>

<template>
  <div ref="root" :class="mergePartClass('histoire-extension-view', classes?.root)" :inert="interactive === false ? true : undefined" :style="interactive === false ? { pointerEvents: 'none' } : undefined" :data-histoire-interactive="interactive" :data-histoire-contribution="id">
    <template v-if="failure">
      <slot name="error" :error="failure.error">
        <WorkbenchErrorState :title="name ? `${name} failed` : 'Extension failed'">
          {{ errorMessage }}
        </WorkbenchErrorState>
      </slot>
    </template>
    <component :is="viewComponent" v-else-if="viewComponent" :context="current" @vue:mounted="onComponentMounted" />
    <template v-else-if="pending">
      <slot name="pending">
        <WorkbenchLoadingState :title="name ? `Loading ${name}` : 'Loading extension'" />
      </slot>
    </template>
    <div v-if="!viewComponent" v-show="!failure" ref="container" :class="mergePartClass('histoire-extension-mount', classes?.mount)" />
  </div>
</template>
