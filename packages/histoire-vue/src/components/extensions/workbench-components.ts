// Native implementations of the workbench state and pane layout components plugin views use
// through `@histoire/plugin-kit/vue`. Same props and slots as the standalone workbench ones;
// styled by `styles/extensions.css` with the provider theme tokens.
import type { WorkbenchComponents } from '@histoire/plugin-kit'
import type { SlotsType, VNode } from 'vue'
import { BuiltinIcon, HstPulsatingDisc } from '@histoire/controls/vue'
import { WORKBENCH_COMPONENTS_KEY } from '@histoire/plugin-kit'
import { defineComponent, h, inject, provide } from 'vue'

/** Slots of the state components. */
type StateSlots = SlotsType<{
  /** Optional detail line. */
  default?: () => VNode[]
  /** Optional follow-up or recovery buttons. */
  actions?: () => VNode[]
}>

/** Slots of the layout components. */
type LayoutSlots = SlotsType<{
  /** Content. */
  default?: () => VNode[]
}>

/**
 * Shared state layout: visual, headline, optional detail and actions.
 * @param attributes Root attributes (role, state kind).
 * @param visual Icon badge or busy disc.
 * @param title Headline.
 * @param slots Detail and actions slots.
 * @param slots.default Detail slot.
 * @param slots.actions Actions slot.
 */
function state(attributes: Record<string, string>, visual: VNode, title: string, slots: { default?: () => VNode[], actions?: () => VNode[] }) {
  return h('div', { class: 'histoire-state', ...attributes }, [
    h('span', { 'class': 'histoire-state-visual', 'aria-hidden': 'true' }, visual),
    h('strong', title),
    slots.default ? h('p', slots.default()) : null,
    slots.actions ? h('div', { class: 'histoire-state-actions' }, slots.actions()) : null,
  ])
}

/** Native empty state. */
const EmptyState = defineComponent({
  name: 'HistoireWorkbenchEmptyState',
  props: { icon: { type: String, required: true }, title: { type: String, required: true } },
  slots: Object as StateSlots,
  setup: (props, { slots }) => () => state({ 'role': 'status', 'data-state': 'empty' }, h(BuiltinIcon, { icon: props.icon, size: 20 }), props.title, slots),
})

/** Native loading state. */
const LoadingState = defineComponent({
  name: 'HistoireWorkbenchLoadingState',
  props: { title: { type: String, required: true } },
  slots: Object as StateSlots,
  setup: (props, { slots }) => () => state({ 'role': 'status', 'aria-atomic': 'true', 'data-state': 'loading' }, h(HstPulsatingDisc, { size: 24 }), props.title, { default: slots.default }),
})

/** Native error state, announced as an alert. */
const ErrorState = defineComponent({
  name: 'HistoireWorkbenchErrorState',
  props: { icon: { type: String, default: 'error-filled' }, title: { type: String, required: true } },
  slots: Object as StateSlots,
  setup: (props, { slots }) => () => state({ 'role': 'alert', 'aria-atomic': 'true', 'data-state': 'error' }, h(BuiltinIcon, { icon: props.icon, size: 20 }), props.title, slots),
})

/** Native pane header. */
const PaneHeader = defineComponent({
  name: 'HistoireWorkbenchPaneHeader',
  props: { title: { type: String, required: true } },
  slots: Object as LayoutSlots,
  setup: (props, { slots }) => () => h('header', { class: 'histoire-pane-header' }, [h('h2', props.title), slots.default?.()]),
})

/** Native pane toolbar row. */
const PaneToolbar = defineComponent({
  name: 'HistoireWorkbenchPaneToolbar',
  slots: Object as LayoutSlots,
  setup: (_props, { slots }) => () => h('div', { class: 'histoire-pane-toolbar' }, slots.default?.()),
})

/** Native pane list body. */
const PaneList = defineComponent({
  name: 'HistoireWorkbenchPaneList',
  slots: Object as LayoutSlots,
  setup: (_props, { slots }) => () => h('div', { class: 'histoire-pane-list' }, slots.default?.()),
})

/** Components native providers hand to plugin views. */
export const histoireWorkbenchComponents: Readonly<WorkbenchComponents> = Object.freeze({
  WorkbenchEmptyState: EmptyState,
  WorkbenchLoadingState: LoadingState,
  WorkbenchErrorState: ErrorState,
  WorkbenchPaneHeader: PaneHeader,
  WorkbenchPaneToolbar: PaneToolbar,
  WorkbenchPaneList: PaneList,
})

/**
 * Provides the native components unless an enclosing workbench (the standalone app, or an
 * outer provider) already did, so nested selected-frame providers keep the outer look.
 */
export function provideNativeWorkbenchComponents(): void {
  if (!inject(WORKBENCH_COMPONENTS_KEY, null)) provide(WORKBENCH_COMPONENTS_KEY, histoireWorkbenchComponents)
}
