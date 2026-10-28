// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { getFrameworkInspection, invalidateFrameworkInspection } from '../../../../histoire-shared/src/inspection/provider-registry.js'
import { createPreviewHost } from '../app/host.js'

const hosts: Array<ReturnType<typeof createPreviewHost>> = []
afterEach(() => {
  hosts.splice(0).forEach(host => host.unmount())
  document.body.innerHTML = ''
})

/** Exercise the actual Vue story-host lifecycle and inspection opt-in. */
async function mountHost(enabled: boolean, mode: 'render' | 'mount' = 'render', slotName = 'default') {
  const actor = document.createElement('div')
  actor.setAttribute('data-histoire-runtime-content', '')
  actor.setAttribute('data-histoire-variant-id', 'variant')
  const root = document.createElement('div')
  actor.append(root)
  document.body.append(actor)
  const variant = { id: 'variant', state: {}, configReady: true } as any
  const story = { id: 'story', file: { component: defineComponent({ name: 'OwnedStory', setup: () => () => h('button', { 'data-inspect': '' }, 'Story') }) }, variants: [variant] } as any
  const renderContext = { mode, slotName, currentVariant: variant, externalState: {}, nextVariantIndex: { value: 0 } }
  const host = createPreviewHost({ name: 'InspectionHost', el: root, getStory: () => story, getVariant: () => variant, renderContext, enableInspection: enabled })
  hosts.push(host)
  await host.mount()
  return { host, root, actor, renderContext }
}

describe('vue story inspection lifecycle', () => {
  it('keeps disabled, hidden and controls mounts unavailable', async () => {
    const disabled = await mountHost(false)
    const hidden = await mountHost(true, 'mount')
    const controls = await mountHost(true, 'render', 'controls')
    expect(disabled.host.getInspectionProvider()).toBeNull()
    expect(hidden.host.getInspectionProvider()).toBeNull()
    expect(controls.host.getInspectionProvider()).toBeNull()
    expect(getFrameworkInspection(disabled.actor)).toBeUndefined()
    expect(getFrameworkInspection(hidden.actor)).toBeUndefined()
    expect(getFrameworkInspection(controls.actor)).toBeUndefined()
  })

  it('retires the old provider when a render host changes slots and never revives it', async () => {
    const { host, actor, renderContext } = await mountHost(true)
    const previous = getFrameworkInspection(actor)!
    const id = previous.componentForElement('[data-inspect]').node!.id
    renderContext.slotName = 'controls'
    host.refreshInspection()
    expect(getFrameworkInspection(actor)).toBeUndefined()
    expect(() => previous.component(id)).toThrow('RUNTIME_CHANGED')
    renderContext.slotName = 'default'
    host.refreshInspection()
    expect(getFrameworkInspection(actor)).not.toBe(previous)
    expect(() => previous.component(id)).toThrow('RUNTIME_CHANGED')
  })

  it('binds lazy provider to exact render mount and retires it on unmount', async () => {
    const first = await mountHost(true)
    const second = await mountHost(true)
    const firstProvider = first.host.getInspectionProvider()!
    const secondProvider = second.host.getInspectionProvider()!
    expect(getFrameworkInspection(first.actor)).toBe(firstProvider)
    expect(getFrameworkInspection(second.actor)).toBe(secondProvider)
    const firstNode = firstProvider.componentForElement('[data-inspect]').node!
    const secondNode = secondProvider.componentForElement('[data-inspect]').node!
    expect(firstNode.name).toBe('OwnedStory')
    expect(secondNode.id).not.toBe(firstNode.id)
    first.host.unmount()
    expect(getFrameworkInspection(first.actor)).toBeUndefined()
    expect(() => firstProvider.component(firstNode.id)).toThrow('RUNTIME_CHANGED')
    expect(secondProvider.component(secondNode.id).node.id).toBe(secondNode.id)
    expect(first.host.getInspectionProvider()).toBeNull()
  })

  it('retires current IDs during same-target runtime replacement', async () => {
    const { host, actor } = await mountHost(true)
    const previous = getFrameworkInspection(actor)!
    const previousId = previous.componentForElement('[data-inspect]').node!.id
    invalidateFrameworkInspection(actor)
    const next = getFrameworkInspection(actor)!
    expect(next.componentForElement('[data-inspect]').node!.id).not.toBe(previousId)
    expect(() => previous.component(previousId)).toThrow('RUNTIME_CHANGED')
    host.unmount()
    expect(getFrameworkInspection(actor)).toBeUndefined()
  })
})
