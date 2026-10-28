import type { WorkbenchHost } from '../../../histoire-app/src/app/extensions/create-workbench-host.js'
import type { WorkbenchProps } from '../../../histoire-app/src/app/standalone/workbench-types.js'
import { createHistoireSessionWithAdapters } from '@histoire/sdk/internal'
import { HistoireProvider } from '@histoire/vue'
import { mount } from '@vue/test-utils'
import { expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { useStandaloneExtensionHost } from '../../../histoire-app/src/app/extensions/standalone.js'
import { histoireConfig } from '../../../histoire-app/src/app/util/config.js'
import { sourceFixture } from '../../../histoire-sdk/src/__tests__/fixtures/session.js'

vi.mock('virtual:$histoire-config', () => ({ config: { theme: {}, inspection: { enabled: false } }, logos: {} }))

it('standalone exposes inspection only when the project opted in and the source supports it', async () => {
  const source = sourceFixture()
  source.descriptor.inspection = { variant: { available: true } }
  const session = createHistoireSessionWithAdapters({ url: 'https://book.example/' }, source.adapters)
  onTestFinished(() => session.dispose())
  await session.connect()
  await session.selection.select({ storyId: 'a:b', variantId: 'c' })
  const props = {
    session,
    runtime: { current: shallowRef(session) },
    navigation: { bindSettingsSections: () => () => {} },
    hostWindow: window,
    previewBase: 'https://book.example/',
  } as unknown as WorkbenchProps
  const targets = { inspectorTab: () => {}, pane: () => {}, settings: () => {}, canvasView: () => {} }
  const hosts: WorkbenchHost[] = []
  const Host = defineComponent({ setup() {
    hosts.push(useStandaloneExtensionHost(props, targets))
    return () => h('div')
  } })
  const wrappers: ReturnType<typeof mount>[] = []
  onTestFinished(() => {
    for (const wrapper of wrappers) wrapper.unmount()
    histoireConfig.inspection!.enabled = false
  })
  wrappers.push(mount(HistoireProvider, { props: { session }, slots: { default: () => h(Host) } }))
  await hosts[0].host.ready
  expect(hosts[0].host.contributions('inspector.tab')).toEqual([])
  histoireConfig.inspection!.enabled = true
  wrappers.push(mount(HistoireProvider, { props: { session }, slots: { default: () => h(Host) } }))
  await hosts[1].host.ready
  expect(hosts[1].host.contributions('inspector.tab').map(tab => tab.id)).toEqual(['histoire-inspection:state'])
  source.descriptor.inspection = { variant: { available: false } }
  source.emitCatalog()
  expect(hosts[1].host.contributions('inspector.tab')).toEqual([])
})
