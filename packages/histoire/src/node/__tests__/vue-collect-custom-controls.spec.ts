// @vitest-environment jsdom
import type { ServerStory } from '@histoire/shared'
import type { Slots } from 'vue'
import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import Story from '../../../../histoire-plugin-vue/src/client/server/Story.js'
import Variant from '../../../../histoire-plugin-vue/src/client/server/Variant.js'

/** Collects one story whose `Story` and `Variant` tags get the given slots. */
function collect(storySlots: Slots, variantSlots: Slots[]) {
  const storyData: ServerStory[] = []
  const app = createApp({
    provide: { addStory: (data: ServerStory) => storyData.push(data) },
    render: () => h(Story, { data: { id: 'story', fileName: 'Story' } }, {
      ...storySlots,
      default: () => variantSlots.map(slots => h(Variant, null, slots)),
    }),
  })
  app.mount(document.createElement('div'))
  app.unmount()
  return storyData[0]
}

const content = () => h('span')

describe('vue collection custom controls', () => {
  it('reports stories without a controls slot', () => {
    expect(collect({}, [{ default: content }, { default: content }]).hasCustomControls).toBe(false)
  })

  it('reports a story-level controls slot', () => {
    expect(collect({ controls: content }, [{ default: content }]).hasCustomControls).toBe(true)
  })

  it('reports a controls slot on any variant', () => {
    expect(collect({}, [{ default: content }, { default: content, controls: content }]).hasCustomControls).toBe(true)
  })
})
