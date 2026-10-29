import type { Component } from 'vue'
import type { WorkbenchComponents } from '../render/workbench-components.js'
import { defineComponent, h, inject } from 'vue'
import { WORKBENCH_COMPONENTS_KEY } from '../render/workbench-components.js'

/** Primary panel action rendered by host, with accessible fallback for external hosts. */
export const WorkbenchPanelAction = defineComponent({
  name: 'WorkbenchPanelAction',
  props: {
    /** Offline Carbon glyph name. */
    icon: { type: String, required: true },
    /** Visible action label. */
    label: { type: String, required: true },
    /** Disable action and optional options trigger. */
    disabled: Boolean,
    /** Accessible name of optional options menu. */
    menuLabel: { type: String, default: undefined },
    /** Optional menu width in pixels. */
    menuWidth: { type: Number, default: undefined },
  },
  emits: {
    /** Main action activated. */
    click: (_event: MouseEvent) => true,
  },
  setup(props, { emit, slots }) {
    const component = inject<WorkbenchComponents | null>(WORKBENCH_COMPONENTS_KEY, null)?.WorkbenchPanelAction as Component | undefined
    return () => component
      ? h(component, { ...props, onClick: (event: MouseEvent) => emit('click', event) }, slots)
      : h('button', { type: 'button', disabled: props.disabled, onClick: (event: MouseEvent) => emit('click', event) }, props.label)
  },
})
