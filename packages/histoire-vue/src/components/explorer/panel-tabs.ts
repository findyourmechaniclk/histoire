import type { BuiltinInspectorTabDescriptor, FrameScopedContext, QualifiedContribution } from '@histoire/plugin-kit'
import type { Component } from 'vue'
import type { HistoireProviderExtensions } from '../../provider/extensions.js'
import { BUILTIN_INSPECTOR_TABS } from '@histoire/plugin-kit'
import { HistoireControls } from '../controls/HistoireControls.js'
import { HistoireDocs } from '../docs/HistoireDocs.js'
import { HistoireEvents } from '../events/HistoireEvents.js'
import { HistoireTests } from '../tests/HistoireTests.js'

/** One built-in explorer panel: shared descriptor plus its native key, label and body. */
export interface NativeBuiltinPanel {
  /** Shared built-in descriptor (`builtin:props`, ...). */
  descriptor: BuiltinInspectorTabDescriptor
  /** Native `activePanel` value (`controls`, `docs`, ...). */
  key: string
  /** Visible label; native explorers keep "Controls" for Props. */
  label: string
  /** Panel body. */
  component: Component
}

/** Native bodies by shared legacy value. */
const BODIES: Record<BuiltinInspectorTabDescriptor['value'], Component> = { '': HistoireControls, 'docs': HistoireDocs, 'events': HistoireEvents, 'tests': HistoireTests }

/** Built-in explorer panels in shared descriptor order; plugin tabs follow them. */
export const NATIVE_BUILTIN_PANELS: readonly NativeBuiltinPanel[] = BUILTIN_INSPECTOR_TABS.map(descriptor => ({
  descriptor,
  key: descriptor.value || 'controls',
  label: descriptor.value ? descriptor.label : 'Controls',
  component: BODIES[descriptor.value],
}))

/**
 * Native panel key of a navigation id: `builtin:` ids map to built-in keys, plugin ids stay.
 * @param id Qualified tab id.
 */
export function getNativePanelKey(id: string): string {
  return NATIVE_BUILTIN_PANELS.find(panel => panel.descriptor.id === id)?.key ?? id
}

/** Active panel resolved against built-ins and the plugin tabs available now. */
export type ResolvedPanel =
  | { type: 'builtin', panel: NativeBuiltinPanel }
  | { type: 'plugin', tab: QualifiedContribution<'inspector.tab'> }
  | { type: 'pending' }

/**
 * Resolves the requested panel. A plugin id waits while plugins set up, so deep links survive
 * startup; afterwards a missing tab falls back to Controls.
 * @param requested Requested native key or plugin id.
 * @param tabs Plugin tabs available now.
 * @param extensions Provider plugin state.
 */
export function resolvePanel(requested: string, tabs: ReadonlyArray<QualifiedContribution<'inspector.tab'>>, extensions: HistoireProviderExtensions): ResolvedPanel {
  const builtin = NATIVE_BUILTIN_PANELS.find(panel => panel.key === requested)
  if (builtin) return { type: 'builtin', panel: builtin }
  const tab = tabs.find(entry => entry.id === requested)
  if (tab) return { type: 'plugin', tab }
  if (extensions.host && !extensions.ready && requested.includes(':')) return { type: 'pending' }
  return { type: 'builtin', panel: NATIVE_BUILTIN_PANELS[0] }
}

/**
 * Plugin badge text; a throwing badge is hidden for good and reported once.
 * @param tab Plugin tab.
 * @param context Inspector context.
 * @param extensions Provider plugin state.
 * @param failed Tabs whose badge already failed.
 */
export function readPluginBadge(tab: QualifiedContribution<'inspector.tab'>, context: FrameScopedContext, extensions: HistoireProviderExtensions, failed: WeakSet<object>): string | number | null | undefined {
  if (!tab.badge || failed.has(tab)) return undefined
  try {
    return tab.badge(context)
  }
  catch (error) {
    failed.add(tab)
    extensions.host?.reportViewError(tab.id, error, 'report')
    return undefined
  }
}
