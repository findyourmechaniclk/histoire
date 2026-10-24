import type { FrameScopedContext, QualifiedContribution } from '@histoire/plugin-kit'
import type { Ref } from 'vue'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useExtensionHost } from '../../composables/extensions.js'

/** Registered plugin inspector tab. */
export type InspectorPluginTab = QualifiedContribution<'inspector.tab'>

/**
 * Plugin inspector contributions of the nearest workbench, bound to the selected frame.
 * @param snapshot Provider snapshot; its publications re-evaluate `available` predicates and badges.
 */
export function useInspectorExtensions(snapshot: Ref<unknown>) {
  const workbench = useExtensionHost()
  const { host, selectedFrame } = workbench
  // Registry, root context and selected-frame changes are not reactive: they bump this revision.
  const revision = ref(0)
  const ready = ref(false)
  const bump = (): void => {
    revision.value++
  }
  const stops = [host.subscribe(bump), selectedFrame.subscribe(bump)]
  onBeforeUnmount(() => {
    for (const stop of stops) stop()
  })
  void host.ready.then(() => {
    ready.value = true
  })

  let last: FrameScopedContext | null = null
  /**
   * Context of the selected ready frame. While the next selected frame loads, the previous
   * context is kept so plugin views receive the new one as an update instead of remounting;
   * `null` before any frame was admitted and whenever no variant is selected.
   */
  const frame = computed((): FrameScopedContext | null => {
    void revision.value
    const current = selectedFrame.current()?.context
    if (current) last = current
    else if (!workbench.context.selection.target?.variantId) last = null
    return last
  })

  /** Plugin tabs shown now, ordered by the registry. */
  const tabs = computed((): readonly InspectorPluginTab[] => {
    void revision.value
    void snapshot.value
    const context = frame.value
    if (context) return host.available('inspector.tab', context)
    // `available` needs a frame context. While none is admitted (selection switching, frame
    // loading), registered tabs stay listed so the active plugin tab is not dropped.
    return host.contributions('inspector.tab').filter(tab => !tab.devOnly || workbench.context.source.mode === 'dev')
  })

  // A throwing badge is hidden for good, like a throwing `available` predicate.
  const failedBadges = new WeakSet<InspectorPluginTab>()
  /**
   * Badge text of a plugin tab in the current frame, or `undefined`.
   * @param tab Plugin tab.
   */
  function badgeOf(tab: InspectorPluginTab): string | number | undefined {
    // Host notifications (including `api.invalidate()`) re-read badges even when the tab list is unchanged.
    void revision.value
    const context = frame.value
    if (!tab.badge || !context || failedBadges.has(tab)) return undefined
    try {
      const value = tab.badge(context)
      return value === null || value === '' ? undefined : value
    }
    catch (error) {
      failedBadges.add(tab)
      host.reportViewError(tab.id, error, 'update')
      return undefined
    }
  }

  return { frame, tabs, ready, badgeOf }
}
