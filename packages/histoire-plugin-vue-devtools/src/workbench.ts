import { defineWorkbenchPlugin } from '@histoire/plugin-kit'
import { mountVueDevtools } from './workbench/panel.js'

/** Defined only on an interactive Vite server with DevTools enabled. */
declare const __HISTOIRE_VUE_DEVTOOLS_ACTIVE__: boolean | undefined

/** Show the upstream Vue DevTools client for the selected story frame. */
export default defineWorkbenchPlugin({
  id: 'vue-devtools',
  apiVersion: 1,
  setup(api) {
    if (typeof __HISTOIRE_VUE_DEVTOOLS_ACTIVE__ === 'undefined' || !__HISTOIRE_VUE_DEVTOOLS_ACTIVE__) return
    api.inspector.addTab({
      id: 'vue',
      label: 'Vue DevTools',
      icon: 'code',
      degradedVisualIntegration: true,
      mount: (container, context, host) => mountVueDevtools(api, container, context, host),
    })
  },
})
