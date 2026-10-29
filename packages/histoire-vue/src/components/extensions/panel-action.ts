import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { defineComponent, h } from 'vue'

/** Native primary panel action matching host control height and theme. */
export const NativeWorkbenchPanelAction = defineComponent({
  name: 'NativeWorkbenchPanelAction',
  props: {
    /** Offline Carbon glyph name. */
    icon: { type: String, required: true },
    /** Visible action label. */
    label: { type: String, required: true },
    /** Whether activation is disabled. */
    disabled: Boolean,
  },
  emits: {
    /** Main action activated. */
    click: (_event: MouseEvent) => true,
  },
  setup: (props, { emit }) => () => h(HstButton, { color: 'primary', disabled: props.disabled, onClick: (event: MouseEvent) => emit('click', event) }, () => [h(BuiltinIcon, { icon: props.icon, size: 16 }), props.label]),
})
