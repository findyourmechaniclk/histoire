import type { Component } from 'vue'
import type { BuiltinInspectorTabValue } from './state.js'
import { defineAsyncComponent } from 'vue'
import EventsBadge from './EventsBadge.vue'
import PropsTab from './PropsTab.vue'
import TestsBadge from './TestsBadge.vue'

// Only the active body renders and Props is the default: the other bodies load on first use,
// keeping them off the inspector's startup graph.
const DocsTab = defineAsyncComponent(() => import('./DocsTab.vue'))
const EventsTab = defineAsyncComponent(() => import('./EventsTab.vue'))
const TestsTab = defineAsyncComponent(() => import('./TestsTab.vue'))

/**
 * Views of one built-in inspector tab. Bodies and badges read per-inspector state through
 * `useInspectorModel()` and emit `error`; Props also accepts the `matrix` slot.
 */
export interface InspectorBuiltinView {
  /** Tab body. */
  component: Component
  /** Optional badge rendered inside the tab button. */
  badge?: Component
}

/**
 * Built-in tab views keyed by route value; identity and order live in
 * `INSPECTOR_BUILTIN_TABS`. A new built-in panel adds one entry in each, never a template branch.
 */
export const INSPECTOR_BUILTIN_VIEWS: Readonly<Record<BuiltinInspectorTabValue, InspectorBuiltinView>> = {
  '': { component: PropsTab },
  'docs': { component: DocsTab },
  'events': { component: EventsTab, badge: EventsBadge },
  'tests': { component: TestsTab, badge: TestsBadge },
}
