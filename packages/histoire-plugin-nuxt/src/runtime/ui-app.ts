import type { Component } from 'vue'
import { defineComponent, h } from 'vue'

/**
 * Story wrapper rendering Nuxt UI's `UApp`, which apps put in `app.vue` and
 * which tooltips, toasts and overlays need. The `story` / `variant` props the
 * story host passes to wrappers are dropped instead of falling through.
 * @param uiApp Nuxt UI `App` component.
 */
export function createUiAppWrapper(uiApp: Component) {
  return defineComponent({
    name: 'HistoireNuxtUiApp',
    inheritAttrs: false,
    setup: (_, { slots }) => () => h(uiApp, null, slots),
  })
}
