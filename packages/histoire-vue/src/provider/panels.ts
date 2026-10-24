import type { HistoireSearchResult, HistoireSourceIdentity, HistoireTarget } from '@histoire/protocol'
import type { HistoireSession } from '@histoire/sdk'
import { getHistoireTargetKey } from '@histoire/protocol'
import { shallowReadonly, shallowRef } from 'vue'

/** A successful search owns a local panel intent, never the host's URL or global active panel. */
export interface HistoireDocsIntent {
  /** Exact canonical selection whose documentation should be visible. */
  target: HistoireTarget
  /** Captured completed source publication; replacement content retires this intent. */
  source: HistoireSourceIdentity
  /** Panel-local documentation anchor, empty when search supplies no anchor. */
  anchor: string
}

/** Provider reuses its snapshot observer to retire local intent without another SDK subscription. */
export function createHistoirePanelNavigation(snapshot: HistoireSession['getSnapshot']) {
  const docs = shallowRef<HistoireDocsIntent | null>(null)
  // Plugin navigation (`openInspectorTab`) publishes a fresh object per request so repeated
  // requests for one tab still notify watchers.
  const tab = shallowRef<{ id: string } | null>(null)
  let active = true
  /** Exact source and selection prevent delayed activation from claiming another provider target. */
  function current(intent: HistoireDocsIntent, value: ReturnType<HistoireSession['getSnapshot']>): boolean {
    return value.status === 'ready' && !value.stale && !!value.selection && getHistoireTargetKey(value.selection) === getHistoireTargetKey(intent.target)
      && value.source?.sourceId === intent.source.sourceId && value.source.epoch === intent.source.epoch && value.source.revision === intent.source.revision
  }
  return {
    /** Readonly reactive intent consumed only by this provider's native panels. */
    docs: shallowReadonly(docs),
    /** Readonly reactive inspector tab request (qualified `builtin:` or plugin id). */
    tab: shallowReadonly(tab),
    /** Plugin navigation asks this provider's explorer panels to show one tab. */
    requestTab(id: string): void {
      if (active) tab.value = { id }
    },
    /** Admit activation against its original source/target; only docs publish local panel intent. */
    showDocs(result: HistoireSearchResult, source: HistoireSourceIdentity | null): boolean {
      if (!active || !source) return false
      const intent = { target: result.target, source, anchor: result.anchor ?? '' }
      if (!current(intent, snapshot())) return false
      if (result.kind === 'docs') docs.value = intent
      return true
    },
    /** Source, navigation and disconnect publications retire old panel anchors immediately. */
    synchronize(value: ReturnType<HistoireSession['getSnapshot']>): void {
      if (docs.value && !current(docs.value, value)) docs.value = null
    },
    /** Explicit tab choice or provider session replacement owns local intent retirement. */
    clear(): void {
      docs.value = null
      tab.value = null
    },
    /** Provider teardown cannot publish another panel activation. */
    close(): void {
      active = false
      docs.value = null
      tab.value = null
    },
  }
}
