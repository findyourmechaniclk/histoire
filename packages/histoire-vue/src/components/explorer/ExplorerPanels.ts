import type { QualifiedContribution } from '@histoire/plugin-kit'
import { HstButton, HstPulsatingDisc } from '@histoire/controls/vue'
import { createContributionKeys } from '@histoire/plugin-kit'
import { defineComponent, h, shallowRef, watch } from 'vue'
import { useHistoireSnapshot } from '../../composables/snapshot.js'
import { useHistoireContext } from '../../provider/context.js'
import { useProvidedHistoireTestsModel } from '../../tests/model.js'
import { HistoireExtensionOutlet } from '../extensions/HistoireExtensionOutlet.js'
import { HistoireExtensionView } from '../extensions/HistoireExtensionView.js'
import { HistoireSource } from '../source/HistoireSource.js'
import { getNativePanelKey, NATIVE_BUILTIN_PANELS, readPluginBadge, resolvePanel } from './panel-tabs.js'

/**
 * Shared independent panels; standalone controls active tab through routing adapter.
 * Built-in tabs come from the descriptors the standalone inspector uses; plugin tabs and
 * sections from the provider's extension host follow them.
 */
export const ExplorerPanels = defineComponent({
  name: 'HistoireExplorerPanels',
  props: {
    activePanel: { type: String, default: undefined },
    docsAnchor: { type: String, default: '' },
    sourceMode: { type: String, default: 'raw' },
  },
  emits: ['panel', 'error'],
  setup(props, { emit }) {
    const snapshot = useHistoireSnapshot()
    const context = useHistoireContext()
    const { extensions } = context
    const tests = useProvidedHistoireTestsModel(context.session)
    const selected = shallowRef('controls')
    const failedBadges = new WeakSet<object>()
    const keyOf = createContributionKeys()
    // Successful docs search activates this provider's shared panel only.
    // Caller slots/visibility and explicitly controlled standalone routing remain authoritative.
    watch(() => context.panels.docs.value, (intent) => {
      if (intent) selected.value = 'docs'
    }, { immediate: true, flush: 'sync' })
    // Plugin navigation (`openInspectorTab`) selects through the same path as a click.
    watch(() => context.panels.tab.value, (intent) => {
      if (intent) select(getNativePanelKey(intent.id))
    }, { flush: 'sync' })
    /** External route owns requested tab; embedded explorer keeps local memory only. */
    function select(value: string): void {
      selected.value = value
      context.panels.clear()
      emit('panel', value)
    }
    /** Inspector sections of one tab and position, or the footer. */
    function sections(tab: string, position?: 'before' | 'after') {
      return h(HistoireExtensionOutlet, { kind: 'inspector.section', filter: (section: QualifiedContribution) => {
        const value = section as QualifiedContribution<'inspector.section'>
        return value.tab === tab && (position === undefined || value.position === position)
      } })
    }
    /** One tab button. */
    function tabButton(key: string, active: boolean, label: unknown) {
      return h(HstButton, { 'color': 'flat', 'type': 'button', 'role': 'tab', 'aria-selected': active, 'onClick': () => select(key) }, { default: () => label })
    }
    return () => {
      const frame = extensions.frame
      const pluginTabs = extensions.available('inspector.tab', frame)
      const requested = props.activePanel ?? selected.value
      const active = resolvePanel(requested, pluginTabs, extensions)
      const activeKey = active.type === 'builtin' ? active.panel.key : active.type === 'plugin' ? active.tab.id : requested
      const activeId = active.type === 'builtin' ? active.panel.descriptor.id : activeKey
      const story = snapshot.value.catalog.stories.find(story => story.id === snapshot.value.selection?.storyId)
      const body = active.type === 'builtin'
        ? h(active.panel.component, { anchor: props.docsAnchor, onError: (error: unknown) => emit('error', error) })
        : active.type === 'plugin' && frame
          ? h(HistoireExtensionView, { key: keyOf(active.tab), contribution: active.tab, context: frame })
          : h('div', { 'aria-busy': 'true', 'aria-label': 'Loading panel' }, h(HstPulsatingDisc, { size: 16 }))
      return h('aside', { 'class': 'histoire-explorer-panels', 'aria-label': 'Histoire panels' }, [
        h('div', { class: 'histoire-explorer-tabs', role: 'tablist' }, [
          ...NATIVE_BUILTIN_PANELS.map(panel => tabButton(panel.key, activeKey === panel.key, [panel.label, panel.key === 'tests' && tests?.state.value.collection ? h('span', { 'aria-label': 'Collected tests' }, ` ${tests.state.value.collection.definitions.length}`) : null])),
          ...pluginTabs.map((tab) => {
            const badge = frame && readPluginBadge(tab, frame, extensions, failedBadges)
            return tabButton(tab.id, activeKey === tab.id, [tab.label, badge != null && badge !== '' ? h('span', null, ` ${badge}`) : null])
          }),
        ]),
        h('div', { class: 'histoire-explorer-panel' }, [sections(activeId, 'before'), body, sections(activeId, 'after')]),
        sections('footer'),
        story?.content.rawSource ? h(HistoireSource, { mode: props.sourceMode === 'dynamic' ? 'dynamic' : 'raw', onError: (error: unknown) => emit('error', error) }) : null,
      ])
    }
  },
})
