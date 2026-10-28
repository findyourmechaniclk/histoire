import type { HistoireSession } from '@histoire/sdk'
import { HistoireSdkError } from '@histoire/protocol'
import { createHistoireSessionWithAdapters } from '@histoire/sdk/internal'
import { HistoireProvider } from '@histoire/vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import InspectionPanel from '../../../histoire-app/src/app/components/inspector/inspection/InspectionPanel.vue'
import { inspectionPluginEntries } from '../../../histoire-app/src/app/components/inspector/inspection/plugin.js'
import StoryInspector from '../../../histoire-app/src/app/components/inspector/StoryInspector.vue'
import { provideExtensionHost } from '../../../histoire-app/src/app/composables/extensions.js'
import { provideShell } from '../../../histoire-app/src/app/composables/shell.js'
import { createShell } from '../../../histoire-app/src/app/stores/shell.js'
import { deferred, sourceFixture } from '../../../histoire-sdk/src/__tests__/fixtures/session.js'
import { createTestWorkbenchHost } from '../../../histoire/src/node/__tests__/utils/workbench-extensions.js'

/** Real SDK/session with a controlled source transport. */
async function frame(available = true, variantId = 'c', domAvailable = false, componentsAvailable = false, auditAvailable = false, highlightAvailable = false) {
  const source = sourceFixture()
  source.descriptor.inspection = { variant: { available }, dom: { available: domAvailable }, components: { available: componentsAvailable }, componentDetails: { available: componentsAvailable }, accessibilityAudit: { available: auditAvailable }, highlightLease: { available: highlightAvailable } }
  const request = source.request.getMockImplementation()!
  let reply: () => Promise<unknown> = async () => result('initial')
  let domReply: () => Promise<unknown> = async () => domResult()
  let componentReply: () => Promise<unknown> = async () => componentResult()
  let auditReply: () => Promise<unknown> = async () => auditResult()
  source.request.mockImplementation((command, payload) => command === 'inspection.variant' ? reply() : command === 'inspection.dom' ? domReply() : command === 'inspection.components' ? Promise.resolve(componentsResult()) : command === 'inspection.component' ? componentReply() : command === 'inspection.accessibility' ? auditReply() : command === 'inspection.highlightLease' ? Promise.resolve(highlightResult()) : command === 'inspection.highlightClear' ? Promise.resolve({ owner: highlightResult().owner, cleared: true }) : request(command, payload))
  const session = createHistoireSessionWithAdapters({ url: 'https://book.example/' }, source.adapters)
  onTestFinished(() => session.dispose())
  await session.connect()
  await session.selection.select({ storyId: 'a:b', variantId })
  const attachment = session.mount(document.createElement('div'), { surface: 'preview' })
  await attachment.ready
  /** Detached response uses transport's exact live owner. */
  function result(label: string) {
    const snapshot = session.getSnapshot()
    return { inspection: 'variant', mode: 'live', owner: { sourceId: snapshot.source!.sourceId, epoch: snapshot.source!.epoch, revision: snapshot.source!.revision, runtimeId: snapshot.runtime.runtimeId!, target: { storyId: 'a:b', variantId } }, observedAt: '2026-01-01T00:00:00Z', durationMs: 0, truncated: false, state: { label }, propsAvailable: false, components: [], omittedValues: 0 }
  }
  /** A detached subtree returned by the runtime transport. */
  function domResult() {
    const { owner, observedAt, durationMs } = result('unused')
    return { inspection: 'dom', mode: 'live', owner, observedAt, durationMs, truncated: false, matched: true, nodes: [{ index: 0, parentIndex: null, tag: 'button', attributes: {}, text: 'Save', rect: { x: 0, y: 0, width: 80, height: 24 }, styles: {} }] }
  }
  /** Component projections use detached document-local identities. */
  function componentsResult() {
    const { owner, observedAt, durationMs } = result('unused')
    return { inspection: 'components', mode: 'live', owner, observedAt, durationMs, truncated: false, coverage: 'partial', limitations: ['source'], omittedCount: 0, nodes: [{ id: 'component-1', parentId: null, name: 'StoryButton', framework: 'vue' }] }
  }
  /** Details of the selected component. */
  function componentResult() {
    const { nodes, omittedCount: _omitted, ...base } = componentsResult()
    return { ...base, inspection: 'component', node: nodes[0], props: { label: 'Save' }, selectors: ['button'], omittedValues: 0 }
  }
  /** Bounded automated findings from the runtime scanner. */
  function auditResult() {
    const { owner, observedAt, durationMs } = result('unused')
    return { inspection: 'accessibility', mode: 'live', owner, observedAt, durationMs, truncated: false, matched: true, engine: 'axe-core', engineVersion: '4.10.2', violations: [{ id: 'image-alt', impact: 'serious', help: 'Images need alternatives', helpUrl: 'https://example.com/rule', nodes: [{ selectors: ['img'], failureSummary: 'Missing alt' }] }], incomplete: [], passesCount: 2, inapplicableCount: 1, droppedCount: 0 }
  }
  /** An owned runtime highlight. */
  function highlightResult() {
    const { owner, observedAt } = result('unused')
    return { owner, observedAt, leaseId: 'owned-lease' }
  }
  return { source, session, attachment, result, domResult, componentResult, auditResult, setAuditReply: (next: () => Promise<unknown>) => {
    auditReply = next
  }, setComponentReply: (next: () => Promise<unknown>) => {
    componentReply = next
  }, setDomReply: (next: () => Promise<unknown>) => {
    domReply = next
  }, setReply: (next: () => Promise<unknown>) => {
    reply = next
  } }
}

/** Mount panel with actual provider and selected frame host. */
async function fixture(available = true, domAvailable = false, componentsAvailable = false, auditAvailable = false, highlightAvailable = false) {
  const first = await frame(available, 'c', domAvailable, componentsAvailable, auditAvailable, highlightAvailable)
  const second = await frame(available, 'other', domAvailable, componentsAvailable, auditAvailable, highlightAvailable)
  const { workbench } = createTestWorkbenchHost({ session: first.session })
  const current = shallowRef<HistoireSession>(first.session)
  const picked = shallowRef<any>()
  workbench.selectedFrame.publish(first.session)
  const Host = defineComponent({ setup() {
    provideExtensionHost(workbench)
    return () => h(HistoireProvider, { session: current.value }, { default: () => h(InspectionPanel, { sourceSession: first.session, picked: picked.value }) })
  } })
  const wrapper = mount(Host, { attachTo: document.body })
  onTestFinished(async () => {
    wrapper.unmount()
    await workbench.dispose()
  })
  return { first, second, workbench, current, picked, wrapper }
}

describe('workbench inspection', () => {
  it('reads the admitted frame and retains its result when a later read fails, then recovers', async () => {
    const { first, wrapper } = await fixture()
    first.setReply(async () => first.result('current value'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('current value')
    first.setReply(async () => {
      throw new HistoireSdkError('PREVIEW_NOT_READY', 'preview runtime failure')
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('current value')
    expect(wrapper.get('[role="alert"]').text()).toContain('variant runtime failure')
    expect(wrapper.get('[role="alert"]').text()).not.toMatch(/preview/i)
    first.setReply(async () => {
      throw new Error('user-authored preview message')
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('user-authored preview message')
    first.setReply(async () => first.result('recovered value'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('recovered value')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('reads a bounded DOM subtree from the selected frame with an explicit selector', async () => {
    const { first, wrapper } = await fixture(true, true)
    await wrapper.get('input').setValue('button')
    const button = wrapper.findAll('button').find(item => item.text().includes('Read DOM'))
    expect(button).toBeDefined()
    await wrapper.get('input').trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.text()).toContain('Save')
    expect(first.source.request.mock.calls.find(([command]) => command === 'inspection.dom')?.[1]).toMatchObject({ selector: 'button', target: { storyId: 'a:b', variantId: 'c' } })
    first.setDomReply(async () => ({ ...first.domResult(), matched: false, nodes: [] }))
    await button!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('No matching element')
    expect(wrapper.text()).not.toContain('Save')
  })

  it('clears the old DOM result when a new pick finds no element', async () => {
    const { first, workbench, picked, wrapper } = await fixture(true, true)
    await wrapper.get('input').setValue('button')
    const read = wrapper.findAll('button').find(item => item.text().includes('Read DOM'))
    await read!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Save')
    picked.value = { owner: first.result('unused').owner, frameKey: workbench.selectedFrame.current()!.context.frame.key, message: 'No element at this point' }
    await flushPromises()
    expect(wrapper.text()).toContain('No element at this point')
    expect(wrapper.text()).not.toContain('Save')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
  })

  it('keeps DOM available when state inspection is unavailable', async () => {
    const { first, wrapper } = await fixture(false, true)
    expect(wrapper.text()).not.toContain('Read state')
    expect(wrapper.text()).toContain('Read DOM')
    await wrapper.get('input').setValue('button')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Save')
    expect(first.source.request.mock.calls.some(([command]) => command === 'inspection.variant')).toBe(false)
  })

  it('shows available components and reads only the selected component details', async () => {
    const { first, wrapper } = await fixture(true, false, true)
    const tree = wrapper.findAll('button').find(item => item.text().includes('Read components'))
    expect(tree).toBeDefined()
    await tree!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('StoryButton')
    expect(wrapper.text()).toContain('Partial coverage')
    const component = wrapper.findAll('button').find(item => item.text().includes('StoryButton'))
    await component!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Save')
    expect(wrapper.text()).not.toContain('runtimeId')
    expect(wrapper.text()).not.toContain('component-1')
    expect(first.source.request.mock.calls.find(([command]) => command === 'inspection.component')?.[1]).toMatchObject({ componentId: 'component-1', target: { storyId: 'a:b', variantId: 'c' } })
    expect(wrapper.text()).not.toContain('Accessibility')
  })

  it('runs an explicit audit for the selected story root and displays bounded findings', async () => {
    const { first, wrapper } = await fixture(true, false, false, true)
    const run = wrapper.findAll('button').find(item => item.text().includes('Run audit'))
    expect(run).toBeDefined()
    expect(first.source.request.mock.calls.some(([command]) => command === 'inspection.accessibility')).toBe(false)
    await run!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Images need alternatives')
    expect(wrapper.text()).toContain('Missing alt')
    expect(wrapper.text()).toContain('img')
    expect(first.source.request.mock.calls.find(([command]) => command === 'inspection.accessibility')?.[1]).toMatchObject({ target: { storyId: 'a:b', variantId: 'c' } })
  })

  it('does not report a clean audit when all findings were omitted', async () => {
    const { first, wrapper } = await fixture(true, false, false, true)
    first.setAuditReply(async () => ({ ...first.auditResult(), violations: [], truncated: true, droppedCount: 3 }))
    const run = wrapper.findAll('button').find(item => item.text().includes('Run audit'))
    await run!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('No retained findings')
    expect(wrapper.text()).toContain('Some findings were omitted')
  })

  it('discards a held audit when its selected frame changes', async () => {
    const { first, second, workbench, current, wrapper } = await fixture(true, false, false, true)
    const held = deferred<unknown>()
    first.setAuditReply(() => held.promise)
    const oldAudit = first.auditResult()
    const run = wrapper.findAll('button').find(item => item.text().includes('Run audit'))
    await run!.trigger('click')
    await flushPromises()
    await first.session.selection.select({ storyId: 'a:b', variantId: 'other' })
    workbench.selectedFrame.publish(second.session)
    current.value = second.session
    await flushPromises()
    held.resolve(oldAudit)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Images need alternatives')
    const secondRun = wrapper.findAll('button').find(item => item.text().includes('Run audit'))
    await secondRun!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Images need alternatives')
  })

  it('clears only its owned highlight when the panel unmounts', async () => {
    const { first, wrapper } = await fixture(true, true, false, false, true)
    await wrapper.get('input').setValue('button')
    const highlight = wrapper.findAll('button').find(item => item.text().includes('Highlight'))
    expect(highlight).toBeDefined()
    await highlight!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Clear highlight')
    wrapper.unmount()
    await flushPromises()
    expect(first.source.request.mock.calls.find(([command]) => command === 'inspection.highlightClear')?.[1]).toMatchObject({ leaseId: 'owned-lease', target: { storyId: 'a:b', variantId: 'c' } })
  })

  it('clears a previous owned highlight when another element is picked', async () => {
    const { first, workbench, picked, wrapper } = await fixture(true, true, false, false, true)
    await wrapper.get('input').setValue('button')
    const highlight = wrapper.findAll('button').find(item => item.text().includes('Highlight'))
    await highlight!.trigger('click')
    await flushPromises()
    picked.value = { owner: first.result('unused').owner, frameKey: workbench.selectedFrame.current()!.context.frame.key, selector: 'img' }
    await flushPromises()
    expect(first.source.request.mock.calls.find(([command]) => command === 'inspection.highlightClear')?.[1]).toMatchObject({ leaseId: 'owned-lease' })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('img')
  })

  it('removes highlight when canonical source withdraws it before the actor updates', async () => {
    const { first, second, workbench, current, wrapper } = await fixture(true, true, false, false, true)
    await first.session.selection.select({ storyId: 'a:b', variantId: 'other' })
    workbench.selectedFrame.publish(second.session)
    current.value = second.session
    await flushPromises()
    expect(wrapper.text()).toContain('Highlight')
    first.source.descriptor.inspection = { variant: { available: true }, dom: { available: true }, highlightLease: { available: false } }
    first.source.emitCatalog()
    await flushPromises()
    expect(wrapper.text()).not.toContain('Highlight')
    expect(second.session.getSnapshot().inspection?.highlightLease?.available).toBe(true)
  })

  it('does not publish component details after switching frames', async () => {
    const { first, second, workbench, current, wrapper } = await fixture(true, false, true)
    const tree = wrapper.findAll('button').find(item => item.text().includes('Read components'))
    await tree!.trigger('click')
    await flushPromises()
    const held = deferred<unknown>()
    first.setComponentReply(() => held.promise)
    const oldDetail = first.componentResult()
    const component = wrapper.findAll('button').find(item => item.text().includes('StoryButton'))
    await component!.trigger('click')
    await flushPromises()
    await first.session.selection.select({ storyId: 'a:b', variantId: 'other' })
    workbench.selectedFrame.publish(second.session)
    current.value = second.session
    await flushPromises()
    held.resolve(oldDetail)
    await flushPromises()
    expect(wrapper.text()).not.toContain('StoryButton')
    expect(wrapper.text()).not.toContain('Save')
    second.setReply(async () => second.result('second frame'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('second frame')
  })

  it('retires an old frame read before showing its successor, even when the old reply arrives late', async () => {
    const { first, second, workbench, current, wrapper } = await fixture()
    const held = deferred<unknown>()
    first.setReply(() => held.promise)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Reading'))
    const oldResult = first.result('old frame')
    await first.session.selection.select({ storyId: 'a:b', variantId: 'other' })
    workbench.selectedFrame.publish(second.session)
    current.value = second.session
    await flushPromises()
    second.setReply(async () => second.result('second frame'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('second frame')
    expect(second.source.request.mock.calls.find(([command]) => command === 'inspection.variant')?.[1]).toMatchObject({ target: { storyId: 'a:b', variantId: 'other' } })
    held.resolve(oldResult)
    await flushPromises()
    expect(wrapper.text()).toContain('second frame')
    expect(wrapper.text()).not.toContain('old frame')
  })

  it('cancels its pending transport work on unmount without closing the caller session', async () => {
    const { first, wrapper } = await fixture()
    const held = deferred<unknown>()
    first.setReply(() => held.promise)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    const calls = first.source.request.mock.calls as unknown as [string, unknown, { signal: AbortSignal }][]
    const capture = calls.find(([command]) => command === 'inspection.variant')?.[2]
    expect(capture?.signal.aborted).toBe(false)
    wrapper.unmount()
    expect(capture?.signal.aborted).toBe(true)
    held.resolve(first.result('late value'))
    await flushPromises()
    expect((await first.session.state.get()).value).toMatchObject({ count: 5 })
  })

  it('clears the result when the same session is retired and admitted again', async () => {
    const { first, workbench, wrapper } = await fixture()
    first.setReply(async () => first.result('previous visit'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('previous visit')
    workbench.selectedFrame.publish(undefined)
    await flushPromises()
    expect(wrapper.text()).toContain('Inspection unavailable')
    expect(wrapper.text()).not.toContain('previous visit')
    workbench.selectedFrame.publish(first.session)
    await flushPromises()
    expect(wrapper.text()).not.toContain('previous visit')
    first.setReply(async () => first.result('new visit'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('new visit')
  })

  it('removes a selected-frame result when its canonical source scope retires', async () => {
    const { first, second, current, workbench, wrapper } = await fixture()
    await first.session.selection.select({ storyId: 'a:b', variantId: 'other' })
    workbench.selectedFrame.publish(second.session)
    current.value = second.session
    await flushPromises()
    second.setReply(async () => second.result('old source'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('old source')
    first.source.descriptor.epoch = 'epoch-2'
    first.source.emitCatalog()
    await flushPromises()
    expect(wrapper.text()).toContain('Inspection unavailable')
    expect(wrapper.text()).not.toContain('old source')
  })

  it('drops old data when capability is withdrawn and requires a fresh read after restoration', async () => {
    const { first, wrapper } = await fixture()
    first.setReply(async () => first.result('withdrawn value'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('withdrawn value')
    first.source.descriptor.inspection = { variant: { available: false } }
    first.source.emitCatalog()
    await flushPromises()
    expect(wrapper.text()).toContain('Inspection unavailable')
    first.source.descriptor.inspection = { variant: { available: true } }
    first.source.emitCatalog()
    await flushPromises()
    expect(wrapper.text()).not.toContain('withdrawn value')
    first.setReply(async () => first.result('fresh value'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('fresh value')
  })

  it('opens the supported inspection contribution in the real inspector', async () => {
    const selected = await frame()
    const entries = inspectionPluginEntries([], true, selected.session, shallowRef(selected.session), () => {})
    const { workbench } = createTestWorkbenchHost({ session: selected.session, plugins: entries })
    onTestFinished(() => workbench.dispose())
    const shell = createShell({ dev: true })
    onTestFinished(() => shell.close())
    workbench.selectedFrame.publish(selected.session)
    await workbench.host.ready
    const Host = defineComponent({ setup() {
      provideExtensionHost(workbench)
      provideShell(shell)
      return () => h(HistoireProvider, { session: selected.session }, { default: () => h(StoryInspector, { activeTab: 'histoire-inspection:state' }) })
    } })
    const wrapper = mount(Host, { attachTo: document.body })
    onTestFinished(() => wrapper.unmount())
    await flushPromises()
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toContain('Inspection')
    expect(wrapper.text()).not.toContain('Accessibility')
    expect(wrapper.text()).not.toContain('Components')
    selected.setReply(async () => selected.result('inspector value'))
    const button = wrapper.findAll('button').find(item => item.text().includes('Read state'))
    expect(button).toBeDefined()
    await button!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="tabpanel"]').text()).toContain('inspector value')
  })

  it('shows unavailable without issuing a read when inspection is disabled', async () => {
    const { first, wrapper } = await fixture(false)
    expect(wrapper.text()).toContain('Inspection unavailable')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(first.source.request.mock.calls.filter(([command]) => command === 'inspection.variant')).toHaveLength(0)
  })
})
