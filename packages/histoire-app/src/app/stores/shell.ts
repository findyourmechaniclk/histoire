import type { ContributionPresence } from '../extensions/shell-registry.js'
import { computed, shallowRef, watch } from 'vue'
import { isPluginContributionId } from '../extensions/shell-registry.js'
import { clampPanelWidth, INSPECTOR_WIDTH_DEFAULT, INSPECTOR_WIDTH_LIMITS, PANEL_WIDTH_DEFAULT, PANEL_WIDTH_LIMITS, resolveShellWidths } from './shell-widths.js'

/** Built-in panel identities; home keeps the full workspace available. */
export type BuiltinShellPane = 'home' | 'stories' | 'search' | 'tests' | 'ai'

/** Plugin rail pane, identified by its qualified contribution id (`<plugin>:<id>`). */
export type PluginShellPane = `${string}:${string}`

/** Local panel identities. */
export type ShellPane = BuiltinShellPane | PluginShellPane

/** Registry view of plugin rail panes; see `createContributionLookup`. */
export interface ShellPaneRegistry {
  /** Presence of one candidate plugin pane id. */
  presence: (id: unknown) => ContributionPresence
  /** Notified when presence may have changed; returns its disposer. */
  subscribe: (listener: () => void) => () => void
}

/** AI pane sections: agent threads or MCP server activity. */
export type AiSection = 'threads' | 'mcp'

/** Persisted shell preference stays independent of session selection and URLs. */
export interface ShellState {
  /** Visible rail destination. */
  pane: ShellPane
  /** Whether a side panel is expanded. */
  panelOpen: boolean
  /** Whether story inspector is visible. */
  inspectorOpen: boolean
  /** Source drawer expansion shared across story selections. */
  sourceExpanded: boolean
  /** Preferred side pane width, retained through responsive changes. */
  panelWidth: number
  /** Preferred inspector width, independent of pane visibility. */
  inspectorWidth: number
  /** Visible section of the AI pane. */
  aiSection: AiSection
}

/** Standalone persistence key; obsolete split-pane keys are never read. */
export const SHELL_STORAGE_KEY = '_histoire-ui-shell'

/** Available client storage; adapters can replace browser persistence. */
export type ShellStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Modes filter unavailable persisted and user-requested destinations alike. Plugin panes
 * are valid only while registered and available in `panes`.
 * @param value Candidate pane.
 * @param dev Dev builds expose tests and AI.
 * @param panes Plugin pane registry; without it plugin panes are rejected.
 */
export function isShellPane(value: unknown, dev: boolean, panes?: ShellPaneRegistry): value is ShellPane {
  if (isPluginContributionId(value)) return panes?.presence(value) === 'available'
  return typeof value === 'string' && (['home', 'stories', 'search'].includes(value) || (dev && ['tests', 'ai'].includes(value)))
}

/** Each mounted workbench owns one small store; no active Pinia/session globals. */
export function createShell(options: {
  /** Dev builds expose tests and AI. */
  dev: boolean
  /** Optional explicit persistence service, usually caller document storage. */
  storage?: ShellStorage
}) {
  const state = shallowRef<ShellState>({ pane: 'stories', panelOpen: true, inspectorOpen: true, sourceExpanded: false, panelWidth: PANEL_WIDTH_DEFAULT, inspectorWidth: INSPECTOR_WIDTH_DEFAULT, aiSection: 'threads' })
  const uiHidden = shallowRef(false)
  const narrow = shallowRef(false)
  const containerWidth = shallowRef(0)
  const inspectorAvailable = shallowRef(false)
  const widths = computed(() => resolveShellWidths({ containerWidth: containerWidth.value, narrow: narrow.value, panelVisible: state.value.panelOpen && state.value.pane !== 'home', inspectorVisible: inspectorAvailable.value && state.value.inspectorOpen, panelWidth: state.value.panelWidth, inspectorWidth: state.value.inspectorWidth }))
  let storage: ShellStorage | undefined
  let closed = false
  let panes: ShellPaneRegistry | undefined
  let stopPanes: (() => void) | undefined
  /** Publish one immutable record so persistence never sees half an action. */
  function update(value: Partial<ShellState>): void {
    if (!closed) state.value = { ...state.value, ...value }
  }
  /** Storage errors leave a usable shell in private/restricted browser contexts. */
  function persist(): void {
    try {
      storage?.setItem(SHELL_STORAGE_KEY, JSON.stringify(state.value))
    }
    catch { /* Preference persistence is optional. */ }
  }
  const stop = watch(state, persist, { flush: 'sync' })
  /** Attach caller storage once and normalize unavailable or malformed state. */
  function restore(value: ShellStorage): void {
    if (closed || storage) return
    let saved: Partial<ShellState> = {}
    try {
      const parsed: unknown = JSON.parse(value.getItem(SHELL_STORAGE_KEY) ?? '{}')
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed
    }
    catch { /* Malformed preferences are replaced by current defaults. */ }
    storage = value
    // Comments merged into the AI pane; older saved preferences still name it.
    const savedPane: unknown = saved.pane === ('comments' as unknown) ? 'ai' : saved.pane
    const pane = isShellPane(savedPane, options.dev, panes) || mayAppear(savedPane) ? savedPane as ShellPane : 'stories'
    update({
      pane,
      panelOpen: pane !== 'home' && (typeof saved.panelOpen === 'boolean' ? saved.panelOpen : true),
      inspectorOpen: typeof saved.inspectorOpen === 'boolean' ? saved.inspectorOpen : true,
      sourceExpanded: typeof saved.sourceExpanded === 'boolean' ? saved.sourceExpanded : false,
      panelWidth: clampPanelWidth(saved.panelWidth, PANEL_WIDTH_LIMITS, PANEL_WIDTH_DEFAULT),
      inspectorWidth: clampPanelWidth(saved.inspectorWidth, INSPECTOR_WIDTH_LIMITS, INSPECTOR_WIDTH_DEFAULT),
      aiSection: saved.aiSection === 'mcp' ? 'mcp' : 'threads',
    })
  }
  /**
   * Plugin panes may still appear while plugin setup has not settled, or before a workbench
   * bound its registry (the shell restores before the extension host exists). Such a pane is
   * kept, shown as loading, and normalized once the registry knows.
   * @param pane Candidate pane.
   */
  function mayAppear(pane: unknown): boolean {
    return isPluginContributionId(pane) && (!panes || panes.presence(pane) === 'pending')
  }
  /** A plugin pane that will not appear (unknown, removed, dev-only in static) recovers to Stories. */
  function normalizePane(): void {
    const pane = state.value.pane
    if (isPluginContributionId(pane) && panes?.presence(pane) === 'missing') update({ pane: 'stories' })
  }
  /**
   * Binds the plugin pane registry of the owning workbench and keeps the current pane valid
   * as plugins settle, register or retire.
   * @param registry Plugin pane registry.
   * @returns Unbinds the registry.
   */
  function bindPanes(registry: ShellPaneRegistry): () => void {
    if (closed) return () => {}
    stopPanes?.()
    panes = registry
    const stop = registry.subscribe(normalizePane)
    stopPanes = stop
    normalizePane()
    return () => {
      if (panes !== registry) return
      stop()
      panes = undefined
      stopPanes = undefined
    }
  }
  /** Active panel buttons collapse; changing panels always reveals the new one. */
  function selectPane(pane: ShellPane): void {
    if (!isShellPane(pane, options.dev, panes)) return
    update({ pane, panelOpen: pane !== 'home' && (state.value.pane !== pane || !state.value.panelOpen) })
  }
  /** Reopening from home restores stories as a useful default panel. */
  function togglePanel(): void {
    update(state.value.pane === 'home' ? { pane: 'stories', panelOpen: true } : { panelOpen: !state.value.panelOpen })
  }
  /** Closing inspector keeps its content selection intact. */
  function toggleInspector(): void {
    update({ inspectorOpen: !state.value.inspectorOpen })
  }
  /** Keep source visibility independent of inspector and selection lifetimes. */
  function toggleSource(): void {
    update({ sourceExpanded: !state.value.sourceExpanded })
  }
  /** Hide workbench chrome for this page session without persisting the choice. */
  function toggleUi(): void {
    if (!closed) uiHidden.value = !uiHidden.value
  }
  /** Switch the AI pane between agent threads and MCP activity. */
  function setAiSection(section: AiSection): void {
    update({ aiSection: section })
  }
  /** Container width, rather than global window, defines narrow fallback. */
  function setNarrow(width: number): void {
    if (!closed && Number.isFinite(width) && width > 0) {
      containerWidth.value = width
      narrow.value = width <= 640
    }
  }
  /** Story routes reserve inspector space; Home and Markdown retain full workspace. */
  function setInspectorAvailable(value: boolean): void {
    if (!closed) inspectorAvailable.value = value
  }
  /** Resize only the pane preference while retaining every other shell choice. */
  function setPanelWidth(value: number): void {
    if (Number.isFinite(value)) update({ panelWidth: clampPanelWidth(value, widths.value.panelBounds, state.value.panelWidth) })
  }
  /** Resize inspector independently, within the current provider workspace. */
  function setInspectorWidth(value: number): void {
    if (Number.isFinite(value)) update({ inspectorWidth: clampPanelWidth(value, widths.value.inspectorBounds, state.value.inspectorWidth) })
  }
  /** Narrow selection dismisses overlay; desktop selection preserves panel. */
  function closePanelAfterSelection(): void {
    if (narrow.value) update({ panelOpen: false })
  }
  /** Retire persistence and ignore actions after caller teardown. */
  function close(): void {
    if (closed) return
    closed = true
    stop()
    stopPanes?.()
    panes = undefined
    storage = undefined
  }
  if (options.storage) restore(options.storage)
  return {
    /** Current panel preference. */
    pane: computed(() => state.value.pane),
    /** Current panel visibility preference. */
    panelOpen: computed(() => state.value.panelOpen),
    /** Current inspector visibility preference. */
    inspectorOpen: computed(() => state.value.inspectorOpen),
    /** Saved source drawer expansion preference. */
    sourceExpanded: computed(() => state.value.sourceExpanded),
    /** Visible AI pane section. */
    aiSection: computed(() => state.value.aiSection),
    /** Whether workbench chrome is temporarily hidden. */
    uiHidden: computed(() => uiHidden.value),
    /** Current container responsive state. */
    narrow: computed(() => narrow.value),
    /** Effective pane width within the measured provider. */
    panelWidth: computed(() => widths.value.panelWidth),
    /** Effective inspector width within the available workspace. */
    inspectorWidth: computed(() => widths.value.inspectorWidth),
    /** Dynamic accessible range of the side pane separator. */
    panelWidthBounds: computed(() => widths.value.panelBounds),
    /** Dynamic accessible range of the inspector separator. */
    inspectorWidthBounds: computed(() => widths.value.inspectorBounds),
    /** Build capability used by rail descriptors. */
    dev: options.dev,
    selectPane,
    togglePanel,
    toggleInspector,
    toggleSource,
    toggleUi,
    setAiSection,
    setNarrow,
    setInspectorAvailable,
    setPanelWidth,
    setInspectorWidth,
    closePanelAfterSelection,
    restore,
    bindPanes,
    close,
  }
}

/** Injection contract can be backed by another per-session adapter. */
export type ShellStore = ReturnType<typeof createShell>
