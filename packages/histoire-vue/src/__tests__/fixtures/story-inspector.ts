import type { WorkbenchPluginEntry } from '../../../../histoire-app/src/app/extensions/plugins.js'
import type { FrameScopedContext } from '../../../../histoire-plugin-kit/src/index.js'
import { createHistoireSessionWithAdapters } from '@histoire/sdk/internal'
import { HistoireProvider } from '@histoire/vue'
import { flushPromises, mount } from '@vue/test-utils'
import { onTestFinished } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import StoryInspector from '../../../../histoire-app/src/app/components/inspector/StoryInspector.vue'
import { provideExtensionHost } from '../../../../histoire-app/src/app/composables/extensions.js'
import { provideShell } from '../../../../histoire-app/src/app/composables/shell.js'
import { createShell } from '../../../../histoire-app/src/app/stores/shell.js'
import { sourceFixture } from '../../../../histoire-sdk/src/__tests__/fixtures/session.js'
import { createSnapshotSession, createTestWorkbenchHost } from '../../../../histoire/src/node/__tests__/utils/workbench-extensions.js'

/**
 * Plugin Vue view showing the selected frame it received plus local click state, so tests see
 * context updates and prove the view was not remounted.
 */
export const FrameProbe = defineComponent({
  props: { context: { type: Object, required: true } },
  setup(props) {
    const clicks = ref(0)
    return () => h('button', { class: 'frame-probe', type: 'button', onClick: () => clicks.value++ }, `${(props.context as FrameScopedContext).frame.target.variantId}:${clicks.value}`)
  },
})

/**
 * Mounts real `StoryInspector`s side by side in one app, under a provider of a connected SDK
 * session and a workbench extension host. Each inspector's `activeTab` follows its own `panel`
 * emissions, as the standalone route does.
 * @param options Plugin entries and the initial route tab of each inspector.
 * @param options.plugins Manifest entries installed in the host.
 * @param options.tabs Initial `?tab=` value per inspector; one inspector by default.
 */
export async function storyInspectorFixture(options: { plugins: WorkbenchPluginEntry[], tabs?: string[] }) {
  const source = sourceFixture()
  const session = createHistoireSessionWithAdapters({ url: 'https://book.example/' }, source.adapters)
  await session.connect()
  await session.selection.select({ storyId: 'a:b', variantId: 'c' })
  const { workbench } = createTestWorkbenchHost({ session, plugins: options.plugins })
  const shell = createShell({ dev: true })
  const tabs = reactive(options.tabs ?? [''])
  /** Values each inspector emitted through `panel`, in order. */
  const panels: string[][] = tabs.map(() => [])
  const Host = defineComponent({
    setup() {
      provideShell(shell)
      provideExtensionHost(workbench)
      return () => h('div', tabs.map((tab, index) => h(StoryInspector, {
        activeTab: tab,
        onPanel: (value: string) => {
          panels[index].push(value)
          tabs[index] = value
        },
      })))
    },
  })
  const wrapper = mount(HistoireProvider, { attachTo: document.body, props: { session }, slots: { default: () => h(Host) } })
  onTestFinished(async () => {
    wrapper.unmount()
    shell.close()
    await workbench.dispose()
    await session.dispose()
  })

  /**
   * Selects a variant and admits its frame, as the canvas does once the frame is ready.
   * @param variantId Variant of story `a:b`.
   */
  async function selectFrame(variantId: string): Promise<void> {
    await session.selection.select({ storyId: 'a:b', variantId })
    workbench.selectedFrame.publish(createSnapshotSession({ storyId: 'a:b', variantId }))
    await flushPromises()
  }

  /**
   * Inspector root of one mounted inspector.
   * @param index Inspector position.
   */
  function inspector(index = 0) {
    return wrapper.findAll('[data-test-id="story-side-panel"]')[index]
  }

  /**
   * Visible tab labels of one inspector with their selected state.
   * @param index Inspector position.
   */
  function tabList(index = 0): string[] {
    return inspector(index).findAll('[role="tab"]').map(tab => `${tab.attributes('aria-selected') === 'true' ? '*' : ''}${tab.text()}`)
  }

  await flushPromises()
  return { wrapper, session, workbench, tabs, panels, selectFrame, inspector, tabList }
}
