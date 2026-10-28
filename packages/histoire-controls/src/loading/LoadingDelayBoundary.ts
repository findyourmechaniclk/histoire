import { defineComponent, provide } from 'vue'

/** Marks a loading slot whose parent already waited for the loading delay. */
export const LOADING_DELAY_ELAPSED = Symbol.for('histoire.loading-delay-elapsed')

/** Avoids applying a second delay to loading components inside an already delayed slot. */
export const LoadingDelayBoundary = defineComponent({
  name: 'HistoireLoadingDelayBoundary',
  setup(_props, { slots }) {
    provide(LOADING_DELAY_ELAPSED, true)
    return () => slots.default?.()
  },
})
