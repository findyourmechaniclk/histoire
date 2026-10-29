import { defineWorkbenchPlugin, installPluginStyles } from '@histoire/plugin-kit'
import { defineWorkbenchComponent } from '@histoire/plugin-kit/vue'
import { defineComponent, h } from 'vue'
import AuditPanel from './workbench/AuditPanel.vue'
import { createAuditModel } from './workbench/model.js'
import css from './workbench/styles.css?inline'

export default defineWorkbenchPlugin({
  id: 'a11y',
  apiVersion: 1,
  setup(api) {
    installPluginStyles(document, 'a11y', css, api.signal)
    const model = createAuditModel(api)
    api.inspector.addTab({
      id: 'accessibility',
      label: 'Accessibility',
      icon: 'list-checked',
      badge: context => model.get(context.frame.key)?.report?.violationsCount || null,
      component: defineWorkbenchComponent(defineComponent({
        name: 'AccessibilityInspector',
        props: {
          /** Current frame scope. */
          context: { type: Object, required: true },
        },
        setup: props => () => h(AuditPanel, { context: props.context as any, model }),
      })),
    })
  },
})
