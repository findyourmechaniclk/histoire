import type { HistoireSession } from '@histoire/sdk'
import type { PropType } from 'vue'
import { HstText } from '@histoire/controls/vue'
import { HistoireControls, HistoireDocs, HistoireEvents, HistoirePreview, HistoireProvider, HistoireSearch, HistoireSource, HistoireStoryTree, HistoireTests, HistoireToolbar } from '@histoire/vue'
import { defineComponent, h, ref } from 'vue'

/** Native parts share provided session; host Vue owns their reactivity and DOM. */
export const BookPanels = defineComponent({
  props: {
    /** Caller-owned connected controller. */
    session: { type: Object as PropType<HistoireSession>, required: true },
  },
  emits: ['error'],
  setup(props, { emit }) {
    const hostControl = ref('Peer Vue')
    return () => h(HistoireProvider, { session: props.session, class: 'book', onError: (error: unknown) => emit('error', error) }, {
      default: () => h('div', { class: 'book-content' }, [
        h(HstText, { 'title': 'Host Vue control', 'aria-label': 'Host Vue control', 'modelValue': hostControl.value, 'onUpdate:modelValue': (value: string) => hostControl.value = value }),
        h('output', hostControl.value),
        h(HistoireToolbar),
        h('div', { class: 'book-layout' }, [
          h('aside', [h(HistoireSearch), h(HistoireStoryTree)]),
          h('div', [
            h(HistoirePreview, { class: 'preview' }),
            h(HistoireControls),
            h(HistoireDocs),
            h(HistoireSource),
            h(HistoireEvents),
            h(HistoireTests),
          ]),
        ]),
      ]),
    })
  },
})
