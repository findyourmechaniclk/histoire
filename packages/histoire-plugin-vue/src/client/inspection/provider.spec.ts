// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineAsyncComponent, defineComponent, Fragment, h, KeepAlive, nextTick, ref, Suspense, Teleport } from 'vue'
import { createVueInspectionProvider } from './provider.js'

const cleanup: Array<() => void> = []

afterEach(() => {
  cleanup.splice(0).reverse().forEach(dispose => dispose())
  document.body.innerHTML = ''
})

/** Mount an actual Vue app, retaining its provider through its real lifetime. */
function mount(component: ReturnType<typeof defineComponent>) {
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp(component)
  app.mount(root)
  const provider = createVueInspectionProvider(app, root)
  cleanup.push(() => {
    provider.dispose()
    app.unmount()
    root.remove()
  })
  return { root, app, provider }
}

describe('vue component inspection ownership', () => {
  it('maps each element to its exact mounted owner without DOM Vue expandos', () => {
    const Child = defineComponent({ name: 'Child', props: ['label'], setup: props => () => h('button', { 'data-label': props.label }, props.label) })
    const Parent = defineComponent({ name: 'Parent', setup: () => () => h('section', [h(Child, { label: 'first' }), h(Child, { label: 'second' })]) })
    const { root, provider } = mount(Parent)
    for (const element of root.querySelectorAll('*')) {
      delete (element as any).__vueParentComponent
      delete (element as any).__vnode
    }
    const first = provider.componentForElement('[data-label="first"]')
    const second = provider.componentForElement('[data-label="second"]')
    expect(first.node?.name).toBe('Child')
    expect(second.node?.name).toBe('Child')
    expect(first.node?.id).not.toBe(second.node?.id)
    expect(provider.component(first.node!.id).props).toEqual({ label: 'first' })
    expect(provider.component(second.node!.id).props).toEqual({ label: 'second' })
    const tree = provider.components()
    expect(tree.nodes.map(node => node.id)).toEqual([tree.nodes[0].id, first.node!.id, second.node!.id])
    expect(first.node!.parentId).toBe(tree.nodes[0].id)
    expect(provider.components({ rootId: second.node!.id }).nodes).toEqual([{ ...second.node!, parentId: null }])
    expect(provider.componentForElement('.missing')).toMatchObject({ matched: false, node: null })
    try {
      provider.componentForElement('[')
      throw new Error('Selector was accepted')
    }
    catch (error) {
      expect((error as { code?: string }).code).toBe('INVALID_SELECTOR')
    }
  })

  it('never invokes getters and omits cycles while preserving safe props and state', () => {
    let calls = 0
    const cyclic: any = { text: 'safe' }
    cyclic.self = cyclic
    Object.defineProperty(cyclic, 'secret', { enumerable: true, get() {
      calls++
      return 'secret'
    } })
    const Child = defineComponent({ name: 'Values', props: ['value'], setup: () => ({ cyclic }), render() {
      return h('span', { id: 'values' })
    } })
    const { provider } = mount(defineComponent({ setup: () => () => h(Child, { value: 42 }) }))
    const owner = provider.componentForElement('#values').node!
    const detail = provider.component(owner.id)
    expect(detail.props).toEqual({ value: 42 })
    expect(detail.state?.cyclic).toMatchObject({ text: 'safe' })
    expect(detail.omittedValues).toBeGreaterThan(0)
    expect(JSON.stringify(detail)).not.toContain('secret')
    expect(calls).toBe(0)
  })

  it('invalidates removed instances and disposed owners without reviving reused names', async () => {
    const visible = ref(true)
    const Child = defineComponent({ name: 'Repeated', setup: () => () => h('button', { id: 'repeat' }) })
    const { provider } = mount(defineComponent({ setup: () => () => visible.value ? h(Child) : null }))
    const old = provider.componentForElement('#repeat').node!.id
    visible.value = false
    await nextTick()
    expect(() => provider.component(old)).toThrow('RUNTIME_CHANGED')
    visible.value = true
    await nextTick()
    const current = provider.componentForElement('#repeat').node!.id
    expect(current).not.toBe(old)
    provider.dispose()
    expect(() => provider.component(current)).toThrow('RUNTIME_CHANGED')
  })

  it('resolves exact active component instances to their rendered elements', async () => {
    const shown = ref(true)
    const Child = defineComponent({ name: 'Child', props: ['label'], setup: props => () => h('button', { 'data-label': props.label }, props.label) })
    const { root, provider } = mount(defineComponent({ setup: () => () => h('section', [h(Child, { label: 'first' }), shown.value && h(Child, { label: 'second' })]) }))
    const first = provider.componentForElement('[data-label="first"]').node!.id
    const second = provider.componentForElement('[data-label="second"]').node!.id
    expect(provider.resolveComponentElement(first)).toBe(root.querySelector('[data-label="first"]'))
    expect(provider.resolveComponentElement(second)).toBe(root.querySelector('[data-label="second"]'))
    shown.value = false
    await nextTick()
    expect(() => provider.resolveComponentElement(second)).toThrow('RUNTIME_CHANGED')
    expect(provider.resolveComponentElement(first)).toBe(root.querySelector('[data-label="first"]'))
    provider.dispose()
    expect(() => provider.resolveComponentElement(first)).toThrow('RUNTIME_CHANGED')
  })

  it('rejects components with multiple roots or teleported output', () => {
    const Multi = defineComponent({ name: 'Multi', setup: () => () => h(Fragment, [h('span'), h('button')]) })
    const Outside = defineComponent({ name: 'Outside', setup: () => () => h(Teleport, { to: 'body' }, h('button', { id: 'highlight-teleport' })) })
    const { provider } = mount(defineComponent({ setup: () => () => h('section', [h(Multi), h(Outside)]) }))
    const tree = provider.components()
    const multi = tree.nodes.find(node => node.name === 'Multi')!
    const outside = tree.nodes.find(node => node.name === 'Outside')!
    expect(() => provider.resolveComponentElement(multi.id)).toThrow('CAPABILITY_UNAVAILABLE')
    expect(() => provider.resolveComponentElement(outside.id)).toThrow('CAPABILITY_UNAVAILABLE')
  })

  it('fails closed when bounded traversal cannot establish component ownership', () => {
    const Child = defineComponent({ name: 'Item', setup: () => () => h('button') })
    const { provider } = mount(defineComponent({ setup: () => () => h('section', Array.from({ length: 501 }, () => h(Child))) }))
    const id = provider.components().nodes.find(node => node.name === 'Item')!.id
    expect(() => provider.resolveComponentElement(id)).toThrow('CAPABILITY_UNAVAILABLE')
  })

  it('reports teleported content outside the captured root as unavailable', () => {
    const target = document.createElement('div')
    target.id = 'outside'
    document.body.append(target)
    const Child = defineComponent({ name: 'Teleported', setup: () => () => h(Teleport, { to: '#outside' }, h('button', { id: 'outside-button' })) })
    const { provider } = mount(Child)
    const result = provider.componentForElement('#outside-button')
    expect(result.node).toBeNull()
    expect(result.coverage).toBe('partial')
    expect(result.limitations).toContain('teleport')
  })

  it('does not guess owners of teleported or unmanaged nodes inside the root', async () => {
    const Child = defineComponent({ name: 'TeleportedChild', setup: () => () => h('button', { id: 'teleported' }) })
    const Parent = defineComponent({ name: 'Parent', setup: () => () => h('section', [h('div', { id: 'teleport-target' }), h(Teleport, { to: '#teleport-target', defer: true }, h(Child))]) })
    const { root, provider } = mount(Parent)
    await nextTick()
    const unmanaged = document.createElement('button')
    unmanaged.id = 'unmanaged'
    root.querySelector('section')!.append(unmanaged)
    expect(provider.componentForElement('#teleported')).toMatchObject({ matched: true, node: null, unavailableReason: 'owner-unavailable' })
    expect(provider.componentForElement('#unmanaged')).toMatchObject({ matched: true, node: null, unavailableReason: 'owner-unavailable' })
  })

  it('finds owners in fragments and slots while respecting tree bounds', () => {
    const Child = defineComponent({ name: 'FragmentChild', setup: (_, { slots }) => () => h(Fragment, [h('span', { id: 'fragment' }), slots.default?.()]) })
    const { provider } = mount(defineComponent({ name: 'Root', setup: () => () => h(Child, null, { default: () => h('button', { id: 'slot' }) }) }))
    expect(provider.componentForElement('#fragment').node?.name).toBe('FragmentChild')
    expect(provider.componentForElement('#slot').node?.name).toBe('FragmentChild')
    expect(provider.components({ maxNodes: 1 })).toMatchObject({ truncated: true, omittedCount: 1, nodes: [{ name: 'Root' }] })
  })

  it('does not guess an ancestor when traversal omits the selected owner', () => {
    const Child = defineComponent({ name: 'Item', props: ['index'], setup: props => () => h('button', { id: `item-${props.index}` }) })
    const { provider } = mount(defineComponent({ name: 'Many', setup: () => () => h('section', Array.from({ length: 501 }, (_, index) => h(Child, { index }))) }))
    expect(provider.componentForElement('#item-500')).toMatchObject({ matched: true, node: null, unavailableReason: 'owner-unavailable', truncated: true })
    const tree = provider.components()
    expect(tree.truncated).toBe(true)
    expect(tree.omittedCount).toBe(502 - tree.nodes.length)
  })

  it('bounds complete component trees and reports clipped nodes', () => {
    const Child = defineComponent({ name: 'x'.repeat(256), setup: () => () => h('span') })
    const { provider } = mount(defineComponent({ name: 'Root', setup: () => () => h('section', Array.from({ length: 300 }, () => h(Child))) }))
    const tree = provider.components()
    expect(tree.nodes[0].name).toBe('Root')
    expect(tree.nodes.length).toBeLessThan(301)
    expect(tree.omittedCount).toBe(301 - tree.nodes.length)
    expect(tree.truncated).toBe(true)
    expect(new TextEncoder().encode(JSON.stringify(tree)).byteLength).toBeLessThanOrEqual(36 * 1024)
  })

  it('bounds the combined props, data and setup state result', () => {
    const large = (prefix: string) => Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`${prefix}${index}`, 'x'.repeat(4000)]))
    const Child = defineComponent({ name: 'Large', props: Object.keys(large('prop')), data: () => large('data'), setup: () => large('setup'), render: () => h('button', { id: 'large' }) })
    const { provider } = mount(defineComponent({ setup: () => () => h(Child, large('prop')) }))
    const owner = provider.componentForElement('#large').node!
    const detail = provider.component(owner.id)
    expect(detail.props.prop0).toBe('x'.repeat(4000))
    expect(detail.state?.data0).toBe('x'.repeat(4000))
    expect(detail.omittedValues).toBeGreaterThan(0)
    expect(detail.truncated).toBe(true)
    expect(new TextEncoder().encode(JSON.stringify(detail)).byteLength).toBeLessThanOrEqual(36 * 1024)
  })

  it('reports async and KeepAlive coverage while retiring inactive owners', async () => {
    const visible = ref(true)
    const Child = defineComponent({ name: 'Cached', setup: () => () => h('button', { id: 'cached' }) })
    const Async = defineAsyncComponent(async () => Child)
    const Root = defineComponent({ setup: () => () => h(Suspense, null, { default: () => h(KeepAlive, null, () => visible.value ? h(Async) : null) }) })
    const { provider } = mount(Root)
    for (let attempts = 0; attempts < 10 && !document.querySelector('#cached'); attempts++) await nextTick()
    const found = provider.componentForElement('#cached')
    expect(found.node?.name).toBe('Cached')
    expect(found.limitations).toContain('async')
    const previous = found.node!.id
    visible.value = false
    await nextTick()
    expect(() => provider.component(previous)).toThrow('RUNTIME_CHANGED')
    visible.value = true
    await nextTick()
    const reactivated = provider.componentForElement('#cached').node!
    expect(reactivated.name).toBe('Cached')
    expect(provider.component(reactivated.id).node.id).toBe(reactivated.id)
    if (reactivated.id !== previous) expect(() => provider.component(previous)).toThrow('RUNTIME_CHANGED')
  })
})
