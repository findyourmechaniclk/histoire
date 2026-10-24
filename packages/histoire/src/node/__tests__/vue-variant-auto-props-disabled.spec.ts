// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createPreviewHost } from '../../../../histoire-plugin-vue/src/client/app/host.js'
import Story from '../../../../histoire-plugin-vue/src/client/app/Story.js'
import Variant from '../../../../histoire-plugin-vue/src/client/app/Variant.js'

/** Component whose props auto-detection would list in the Props panel. */
const Target = defineComponent({
  props: { progress: Number },
  render: () => null,
})

const hosts: Array<ReturnType<typeof createPreviewHost>> = []

afterEach(() => {
  hosts.splice(0).forEach(host => host.unmount())
  document.body.innerHTML = ''
})

/**
 * Story file standing for
 * `<Story v-bind="storyProps"><Variant v-bind="variantProps"><Target /></Variant></Story>`,
 * or `<Story v-bind="storyProps"><Target /></Story>` (implicit default variant)
 * when `variantProps` is `null`.
 * @param storyProps Attributes set on `<Story>`, as a compiled template passes them
 * @param variantProps Attributes set on `<Variant>`
 */
function createStory(storyProps: Record<string, any>, variantProps: Record<string, any> | null) {
  const variant: any = { id: variantProps ? 'variant' : '_default', title: 'Variant', state: {} }
  const target = () => h(Target, { progress: 0.5 })
  const component = defineComponent({
    props: { story: Object },
    render() {
      return h(Story, { story: this.story, ...storyProps }, {
        default: variantProps ? () => [h(Variant, variantProps, { default: target })] : target,
      })
    },
  })
  return { story: { id: 'story', title: 'Story', variants: [variant], file: { component } } as any, variant }
}

/**
 * Renders the variant in a host that runs the story mount pass first, like a
 * story frame without a hidden mount app.
 * @param storyProps Attributes set on `<Story>`
 * @param variantProps Attributes set on `<Variant>`, `null` for the implicit default variant
 */
async function renderVariant(storyProps: Record<string, any>, variantProps: Record<string, any> | null = {}) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const { story, variant } = createStory(storyProps, variantProps)
  const host = createPreviewHost({
    name: 'TestHost',
    el,
    getStory: () => story,
    getVariant: () => variant,
    renderContext: { mode: 'render', slotName: 'default', currentVariant: variant, externalState: {}, nextVariantIndex: { value: 0 } } as any,
    configureStory: true,
  })
  hosts.push(host)
  await host.mount()
  return variant
}

describe('vue variant autoPropsDisabled', () => {
  it('detects props by default', async () => {
    const variant = await renderVariant({})
    expect(variant.autoPropsDisabled).toBeFalsy()
    expect(variant.state._hPropDefs?.[0]?.props).toMatchObject([{ name: 'progress' }])
  })

  it('inherits the story-level value in the rendered variant', async () => {
    // Compiled `<Story auto-props-disabled>` passes the attribute as an empty string.
    const variant = await renderVariant({ 'auto-props-disabled': '' })
    expect(variant.autoPropsDisabled).toBe(true)
    expect(variant.state._hPropDefs).toBeUndefined()
  })

  it('inherits the story-level value in the implicit default variant', async () => {
    const variant = await renderVariant({ autoPropsDisabled: true }, null)
    expect(variant.autoPropsDisabled).toBe(true)
    expect(variant.state._hPropDefs).toBeUndefined()
  })

  it('lets the variant value win over the story value', async () => {
    const enabled = await renderVariant({ 'auto-props-disabled': '' }, { autoPropsDisabled: false })
    expect(enabled.autoPropsDisabled).toBe(false)
    expect(enabled.state._hPropDefs?.[0]?.props).toMatchObject([{ name: 'progress' }])

    const disabled = await renderVariant({}, { 'auto-props-disabled': '' })
    expect(disabled.autoPropsDisabled).toBe(true)
    expect(disabled.state._hPropDefs).toBeUndefined()
  })
})
