import type { Story } from '@histoire/shared'
import type { PropType } from 'vue'
import type { PreviewRenderContext } from './render-context.js'
import { defineComponent, h } from 'vue'
import { provideRenderContext } from './render-context.js'

/** Renders the story file component under one render context (mount or render pass). */
export const PreviewHostRoot = defineComponent({
  name: 'PreviewHostRoot',

  props: {
    story: {
      type: Object as PropType<Story>,
      required: true,
    },

    renderContext: {
      type: Object as PropType<PreviewRenderContext>,
      required: true,
    },
  },

  setup(props) {
    provideRenderContext(props.renderContext)

    return () => h(props.story.file.component, {
      story: props.story,
    })
  },
})
