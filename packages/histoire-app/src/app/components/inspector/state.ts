import type { BuiltinInspectorTabDescriptor } from '@histoire/plugin-kit'
import type { HistoireSnapshot } from '@histoire/protocol'
import type { Component } from 'vue'
import { BUILTIN_INSPECTOR_TABS, BUILTIN_NAMESPACE, parseQualifiedId } from '@histoire/plugin-kit'

/** `?tab=` values of the built-in tabs; Props is the empty value. */
export type BuiltinInspectorTabValue = BuiltinInspectorTabDescriptor['value']

/** Route tab value: a built-in value or a qualified plugin tab id (`acme:panel`). */
export type InspectorTab = string

/** Built-in tab identity: qualified descriptor id (sections, navigation) and route value. */
export type InspectorBuiltinTab = BuiltinInspectorTabDescriptor

/** Built-in tabs in display order; plugin tabs follow them. Shared with native explorer panels. */
export const INSPECTOR_BUILTIN_TABS: readonly InspectorBuiltinTab[] = BUILTIN_INSPECTOR_TABS

/** Standalone test surfaces require both a dev build and a connected dev source. */
export function isInspectorTestsEnabled(devBuild: boolean, sourceMode: string | undefined): boolean {
  return devBuild && sourceMode === 'dev'
}

/** Available built-in tabs; also bounds keyboard navigation and URL fallback. */
export function getInspectorTabs(testsEnabled: boolean): readonly InspectorBuiltinTab[] {
  return testsEnabled ? INSPECTOR_BUILTIN_TABS : INSPECTOR_BUILTIN_TABS.filter(tab => tab.value !== 'tests')
}

/** Unknown values and unavailable dev-only Tests URLs resolve to Props. */
export function normalizeInspectorTab(value: unknown, testsEnabled = true): BuiltinInspectorTabValue {
  return value === 'docs' || value === 'events' || (value === 'tests' && testsEnabled) ? value : ''
}

/**
 * Qualified descriptor id of a displayed tab value: `builtin:<name>` for built-in values,
 * the plugin id itself otherwise. Sections attach to these ids.
 * @param value Displayed tab value.
 */
export function getInspectorTabId(value: InspectorTab): string {
  return INSPECTOR_BUILTIN_TABS.find(tab => tab.value === value)?.id ?? value
}

/**
 * Element id fragment of a tab value; built-ins keep their historical fragments
 * (`props`, `docs`, ...), plugin tabs use their qualified id.
 * @param value Displayed tab value.
 */
export function getInspectorTabKey(value: InspectorTab): string {
  return value || 'props'
}

/** One button of the inspector tab list. */
export interface InspectorTabItem {
  /** Route value emitted on selection. */
  value: InspectorTab
  /** Visible label. */
  label: string
  /** Built-in badge component reading inspector state. */
  badge?: Component
  /** Plugin badge text. */
  badgeText?: string | number
  /** Bundled glyph shown before the label (plugin tabs). */
  icon?: string
  /** May move to the overflow menu when the row is full (plugin tabs); built-ins stay in the row. */
  overflow?: boolean
}

/** Route tab resolved against built-ins and the plugin tabs available now. */
export interface InspectorTabResolution {
  /** Displayed tab: built-in value or available plugin tab id. */
  value: InspectorTab
  /** The route names a plugin tab while plugins are still setting up: show a loading state. */
  pending: boolean
  /** The route names a plugin tab that is gone after setup settled: rewrite it to `value`. */
  rewrite: boolean
}

/** Inputs of `resolveInspectorTab`. */
export interface InspectorTabResolutionOptions {
  /** Whether the dev-only Tests tab is available. */
  testsEnabled: boolean
  /** Qualified ids of the plugin tabs shown now. */
  pluginTabs: readonly string[]
  /** Whether every plugin setup settled (`host.ready`). */
  ready: boolean
}

/**
 * Resolves the route `?tab=` value. Built-in values map to their tab. A qualified plugin id is
 * shown when available; before plugin setup settles it stays pending instead of falling back,
 * so deep links survive startup. Afterwards an unknown plugin id falls back to Props and asks
 * for a route rewrite. `builtin:` ids map to their built-in value.
 * @param requested Route value.
 * @param options Available tabs and host readiness.
 */
export function resolveInspectorTab(requested: unknown, options: InspectorTabResolutionOptions): InspectorTabResolution {
  const settled = (value: InspectorTab, rewrite = false): InspectorTabResolution => ({ value, pending: false, rewrite })
  if (typeof requested !== 'string') return settled('')
  if (options.pluginTabs.includes(requested)) return settled(requested)
  const qualified = parseQualifiedId(requested)
  if (!qualified) return settled(normalizeInspectorTab(requested, options.testsEnabled))
  if (qualified.namespace === BUILTIN_NAMESPACE) {
    return settled(normalizeInspectorTab(qualified.localId === 'props' ? '' : qualified.localId, options.testsEnabled))
  }
  return options.ready ? settled('', true) : { value: requested, pending: true, rewrite: false }
}

/** Track unread events locally; retained history never crosses selected document. */
export function createInspectorEventCounter() {
  let owner: string | undefined
  let seen = 0
  return {
    /** Read event ownership only; accepts readonly provider snapshots without mutable state. */
    observe(snapshot: Readonly<Pick<HistoireSnapshot, 'source' | 'selection' | 'runtime' | 'events'>>, visible: boolean): number {
      const identity = JSON.stringify([snapshot.source?.sourceId, snapshot.source?.epoch, snapshot.selection, snapshot.runtime.runtimeId])
      const items = snapshot.events.items.filter(event => event.runtimeId === snapshot.runtime.runtimeId && event.target.storyId === snapshot.selection?.storyId && event.target.variantId === snapshot.selection?.variantId)
      const latest = items.reduce((sequence, event) => Math.max(sequence, event.sequence), 0)
      if ((owner !== undefined && owner !== identity) || visible) seen = latest
      owner = identity
      return items.filter(event => event.sequence > seen).length
    },
  }
}

/** Compare generated text only; initial loading and unchanged snapshots stay unmarked. */
export function findChangedSourceLine(previous: string | undefined, next: string): number {
  if (previous === undefined || previous === next) return -1
  const before = previous.split('\n')
  const after = next.split('\n')
  const changed = after.findIndex((line, index) => line !== before[index])
  return changed === -1 ? Math.max(0, after.length - 1) : changed
}
