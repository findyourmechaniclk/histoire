import type { QualifiedContribution, WorkbenchContext } from '@histoire/plugin-kit'
import type { PropType } from 'vue'
import type { NativeToolbarGroup } from './groups.js'
import { HstButton } from '@histoire/controls/vue'
import { createContributionKeys } from '@histoire/plugin-kit'
import { defineComponent, h, shallowReactive, shallowRef } from 'vue'
import { HistoireDropdown } from '../../foundation/floating.js'
import { useHistoireContext } from '../../provider/context.js'
import { HistoireExtensionView } from '../extensions/HistoireExtensionView.js'
import { nativeToolbarGroup } from './groups.js'

/** Registered toolbar item. */
type ToolbarItem = QualifiedContribution<'toolbar.item'>

/**
 * Plugin toolbar items of one native toolbar group (see `NATIVE_TOOLBAR_GROUPS`), in registry
 * order, from the provider's extension host. Items naming a group without a native counterpart
 * render in the trailing `plugins` group.
 * Actions run once at a time against the root context; toggles re-read `pressed` after each run
 * and on host notifications; popovers and custom items render their views.
 */
export const ToolbarExtensions = defineComponent({
  name: 'HistoireToolbarExtensions',
  props: {
    /** Native group whose items render here. */
    group: { type: String as PropType<NativeToolbarGroup>, required: true },
  },
  emits: ['error'],
  setup(props, { emit }) {
    const { extensions } = useHistoireContext()
    const running = shallowReactive(new Set<string>())
    const failedToggles = new WeakSet<object>()
    // Bumped after each run so toggles re-read `pressed` even without a host notification.
    const runs = shallowRef(0)
    const keyOf = createContributionKeys()

    /** Runs one action item; failures reach the toolbar's error event. */
    function run(item: ToolbarItem, context: WorkbenchContext): void {
      if (running.has(item.id)) return
      running.add(item.id)
      void extensions.run(item.id, context).catch(error => emit('error', error)).finally(() => {
        running.delete(item.id)
        runs.value++
      })
    }

    /** Toggle state; a throwing `pressed` is reported once and reads as unpressed. */
    function pressed(item: ToolbarItem, context: WorkbenchContext): boolean {
      if (item.type !== 'toggle' || failedToggles.has(item)) return false
      try {
        return item.pressed(context)
      }
      catch (error) {
        failedToggles.add(item)
        extensions.host?.reportViewError(item.id, error, 'report')
        return false
      }
    }

    /** Renders one item by type. */
    function render(item: ToolbarItem, context: WorkbenchContext) {
      if (item.type === 'custom') return h(HistoireExtensionView, { key: keyOf(item), contribution: item, context })
      if (item.type === 'popover') {
        return h(HistoireDropdown, { key: keyOf(item), placement: 'bottom' }, {
          default: () => h(HstButton, { 'color': 'flat', 'type': 'button', 'aria-haspopup': 'dialog' }, { default: () => item.label }),
          popper: () => h(HistoireExtensionView, { contribution: item, context }),
        })
      }
      return h(HstButton, {
        'key': keyOf(item),
        'color': 'flat',
        'type': 'button',
        'disabled': running.has(item.id),
        'aria-pressed': item.type === 'toggle' ? pressed(item, context) : undefined,
        'onClick': () => run(item, context),
      }, { default: () => item.label })
    }

    return () => {
      void runs.value
      const context = extensions.context
      if (!context) return null
      return extensions.available('toolbar.item', context).filter(item => nativeToolbarGroup(item.group) === props.group).map(item => render(item, context))
    }
  },
})
