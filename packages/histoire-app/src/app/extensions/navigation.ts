import type { ExtensionHost, NavigationService } from '@histoire/plugin-kit'
import type { HistoireSelectionInput } from '@histoire/protocol'
import { BUILTIN_NAMESPACE, parseQualifiedId } from '@histoire/plugin-kit'
import { INSPECTOR_BUILTIN_TABS } from '../components/inspector/state.js'
import { BUILTIN_CANVAS_ARRANGEMENTS } from '../stores/canvas-arrangement.js'
import { SETTINGS_SECTIONS } from '../stores/settings.js'
import { isShellPane } from '../stores/shell.js'

/**
 * Existing workbench navigation the adapter delegates to. Values are built-in route values
 * (`''`, `docs`, `stories`, `grid`, ...) or qualified plugin ids already validated against the
 * registry; existing route guards still apply (dev-only destinations, unknown arrangements).
 */
export interface WorkbenchNavigationTargets {
  /** Selects a story or variant through the canonical selection. */
  selectStory: (input: HistoireSelectionInput) => Promise<void>
  /** Opens an inspector tab by its `?tab=` value. */
  inspectorTab: (value: string) => void
  /** Opens a rail pane. */
  pane: (value: string) => void
  /** Opens settings, optionally at one section. */
  settings: (section?: string) => void
  /** Switches the canvas arrangement by its `?arrange=` value. */
  canvasView: (value: string) => void
}

/** Contribution kinds navigation can open. */
type NavigableKind = 'inspector.tab' | 'shell.pane' | 'settings.section' | 'canvas.view'

/** Maps a built-in local id to its existing route value, or `undefined` when unknown. */
const BUILTINS: Record<NavigableKind, (localId: string) => string | undefined> = {
  // Built-in descriptor ids map to built-in `?tab=` values (Props is the empty value).
  'inspector.tab': localId => INSPECTOR_BUILTIN_TABS.find(tab => tab.id === `${BUILTIN_NAMESPACE}:${localId}`)?.value,
  'shell.pane': localId => isShellPane(localId, true) ? localId : undefined,
  'settings.section': localId => SETTINGS_SECTIONS.some(section => section.id === localId) ? localId : undefined,
  'canvas.view': localId => (BUILTIN_CANVAS_ARRANGEMENTS as readonly string[]).includes(localId) ? localId : undefined,
}

/** Navigation service plus the late binding to its host (the host needs the service first). */
export interface WorkbenchNavigation {
  /** Service exposed on the root context. */
  readonly service: NavigationService
  /** Binds the registry used to validate plugin targets. */
  attach: (host: ExtensionHost) => void
}

/** Inputs of the navigation adapter. */
export interface WorkbenchNavigationOptions {
  /** Existing navigation. */
  targets: WorkbenchNavigationTargets
  /** Receives diagnostics for ignored targets. */
  warn: (message: string) => void
}

/**
 * Creates the navigation adapter. Built-in ids map to existing route values. Plugin ids open
 * once registered; before `ready` settles an unknown plugin id waits for setup, afterwards it
 * is ignored with a diagnostic. A later navigation of the same kind supersedes a waiting one.
 * @param options Delegated navigation and diagnostics sink.
 */
export function createWorkbenchNavigation(options: WorkbenchNavigationOptions): WorkbenchNavigation {
  const { targets, warn } = options
  let host: ExtensionHost | undefined
  let settled = false
  let attached!: (host: ExtensionHost) => void
  const hostReady = new Promise<ExtensionHost>(resolve => attached = resolve).then(async (bound) => {
    await bound.ready
    return bound
  })
  /** Latest request per kind; waiting requests compare against it before applying. */
  const generations: Record<NavigableKind, number> = { 'inspector.tab': 0, 'shell.pane': 0, 'settings.section': 0, 'canvas.view': 0 }

  /**
   * Whether `id` is a committed contribution of `kind`.
   * @param kind Contribution kind.
   * @param id Qualified id.
   */
  function registered(kind: NavigableKind, id: string): boolean {
    return Boolean(host?.contributions(kind).some(contribution => contribution.id === id))
  }

  /**
   * Resolves one target and applies it, now or after plugin setup settled.
   * @param kind Contribution kind of the target.
   * @param id Qualified id requested by the plugin.
   * @param apply Delegated navigation.
   */
  function open(kind: NavigableKind, id: unknown, apply: (value: string) => void): void {
    const generation = ++generations[kind]
    const parsed = typeof id === 'string' ? parseQualifiedId(id) : null
    if (!parsed) {
      warn(`[histoire] ignored navigation to invalid ${kind} id ${JSON.stringify(id)}`)
      return
    }
    if (parsed.namespace === BUILTIN_NAMESPACE) {
      const value = BUILTINS[kind](parsed.localId)
      if (value === undefined) warn(`[histoire] ignored navigation to unknown ${kind} "${id}"`)
      else apply(value)
      return
    }
    const qualified = id as string
    if (registered(kind, qualified)) {
      apply(qualified)
      return
    }
    if (settled) {
      warn(`[histoire] ignored navigation to unknown ${kind} "${qualified}"`)
      return
    }
    void hostReady.then(() => {
      // A newer navigation of the same kind wins over this deferred one.
      if (generation !== generations[kind]) return
      if (registered(kind, qualified)) apply(qualified)
      else warn(`[histoire] ignored navigation to unknown ${kind} "${qualified}"`)
    })
  }

  return {
    service: Object.freeze({
      selectStory: (input: HistoireSelectionInput) => targets.selectStory(input),
      openInspectorTab: (tabId: string) => open('inspector.tab', tabId, targets.inspectorTab),
      openPane: (paneId: string) => open('shell.pane', paneId, targets.pane),
      openSettings(sectionId?: string) {
        if (sectionId === undefined) {
          generations['settings.section']++
          targets.settings()
        }
        else {
          open('settings.section', sectionId, targets.settings)
        }
      },
      openCanvasView: (viewId: string) => open('canvas.view', viewId, targets.canvasView),
    }),
    attach(bound) {
      if (host) return
      host = bound
      // Registered before any deferred request: `settled` is true when those run.
      void bound.ready.then(() => {
        settled = true
      })
      attached(bound)
    },
  }
}
