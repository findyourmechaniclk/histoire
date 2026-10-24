import type { QualifiedContribution, WorkbenchComponents } from '@histoire/plugin-kit'
import type { Component, PropType } from 'vue'
import { WORKBENCH_COMPONENTS_KEY } from '@histoire/plugin-kit'
import { defineComponent, h, inject } from 'vue'
import { useHistoireContext } from '../../provider/context.js'
import { useExtensionView } from './view-lifecycle.js'
import { histoireWorkbenchComponents } from './workbench-components.js'

/**
 * Renders one contribution's view in a native provider: Vue `component` views through the
 * caller's Vue app (same instance as the plugin when the host imported it), DOM `mount` views
 * through the caller-owned extension host. Context snapshots update the view without remounting.
 * Failures stay local to this view and are recorded as diagnostics of the contribution's plugin.
 * Pending and failed views render the workbench state components plugin views also receive
 * (an enclosing workbench's, else the native ones).
 */
export const HistoireExtensionView = defineComponent({
  name: 'HistoireExtensionView',
  props: {
    /** Fixed for the component lifetime; key the component by contribution object. */
    contribution: { type: Object as PropType<QualifiedContribution>, required: true },
    /** Surface context snapshot. */
    context: { type: Object, required: true },
  },
  setup(props) {
    const provider = useHistoireContext()
    const { id } = props.contribution
    const view = useExtensionView({
      // Captured once: the outlet remounts views when the host or contribution changes.
      host: provider.extensions.host!,
      contribution: props.contribution,
      context: () => props.context,
      overlayParent: () => provider.overlay.value ?? provider.root.value ?? document.body,
    })
    const { name } = view
    const components = inject<WorkbenchComponents | null>(WORKBENCH_COMPONENTS_KEY, null)
    const ErrorState = (components?.WorkbenchErrorState ?? histoireWorkbenchComponents.WorkbenchErrorState) as Component
    const LoadingState = (components?.WorkbenchLoadingState ?? histoireWorkbenchComponents.WorkbenchLoadingState) as Component

    return () => {
      const error = view.failure.value?.error
      return h('div', { 'class': 'histoire-extension-view', 'data-histoire-contribution': id }, [
        view.failure.value
          ? h(ErrorState, { title: name ? `${name} failed` : 'Extension failed' }, () => error instanceof Error ? error.message : String(error ?? ''))
          : view.component
            ? h(view.component, { context: view.current.value, onVnodeMounted: view.onComponentMounted })
            : view.pending.value ? h(LoadingState, { title: name ? `Loading ${name}` : 'Loading extension' }) : null,
        view.component ? null : h('div', { ref: view.container, class: 'histoire-extension-mount', hidden: !!view.failure.value }),
      ])
    }
  },
})
