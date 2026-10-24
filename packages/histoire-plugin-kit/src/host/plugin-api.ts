import type { HistoireJsonValue } from '@histoire/protocol'
import type { Disposer } from '../types/common.js'
import type { WorkbenchContext } from '../types/context.js'
import type { ContributionKind, WorkbenchContribution } from '../types/contribution.js'
import type { WorkbenchPluginApi } from '../types/plugin.js'
import type { PluginPreferences } from '../types/preferences.js'
import { createPluginFrames } from './frames.js'
import { NOOP } from './resources.js'

/** Inputs of one plugin's API object. */
export interface PluginApiOptions {
  /** Plugin id. */
  id: string
  /** Browser-visible options. */
  options: HistoireJsonValue | undefined
  /** Root context; wrapped so subscriptions are plugin-owned. */
  context: WorkbenchContext
  /** Plugin preferences. */
  preferences: PluginPreferences
  /** Plugin scope signal. */
  signal: AbortSignal
  /** Owned registration. */
  contribute: (contribution: WorkbenchContribution) => Disposer
  /** Attributed error report. */
  reportError: (error: unknown) => void
  /** Ties a resource to the plugin lifetime. */
  track: (release: () => void) => Disposer
  /** Notifies host subscribers so surfaces re-read plugin callbacks; inert after retirement. */
  invalidate: () => void
}

/**
 * Wraps the root context so `subscribe` is owned by the plugin and released with it.
 * The proxy targets an empty object so frozen contexts never violate proxy invariants;
 * every other property reads through to the live context (getters stay fresh).
 * @param context Root context.
 * @param signal Plugin scope signal; subscriptions after retirement are refused.
 * @param track Ties a subscription to the plugin lifetime.
 */
function createOwnedContext(context: WorkbenchContext, signal: AbortSignal, track: (release: () => void) => Disposer): WorkbenchContext {
  const subscribe: WorkbenchContext['subscribe'] = listener => signal.aborted ? NOOP : track(context.subscribe(listener))
  return new Proxy({} as WorkbenchContext, {
    get: (_, key) => key === 'subscribe' ? subscribe : Reflect.get(context, key, context),
    has: (_, key) => Reflect.has(context, key),
    ownKeys: () => Reflect.ownKeys(context),
    getOwnPropertyDescriptor(_, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(context, key)
      if (!descriptor) return undefined
      return key === 'subscribe'
        ? { value: subscribe, writable: false, enumerable: descriptor.enumerable, configurable: true }
        : { ...descriptor, configurable: true }
    },
  })
}

/**
 * Builds `WorkbenchPluginApi`; typed helpers are sugar over `contribute`.
 * @param options Plugin identity, services and ownership hooks.
 */
export function createPluginApi(options: PluginApiOptions): WorkbenchPluginApi {
  const { contribute } = options

  /**
   * Helper adding contributions of one kind; `WorkbenchPluginApi` types each input shape.
   * @param kind Contribution kind stamped on each input.
   */
  const add = (kind: ContributionKind) =>
    (input: object): Disposer => contribute({ ...input, kind } as WorkbenchContribution)

  return {
    id: options.id,
    options: options.options,
    context: createOwnedContext(options.context, options.signal, options.track),
    preferences: options.preferences,
    signal: options.signal,
    contribute,
    inspector: { addTab: add('inspector.tab'), addSection: add('inspector.section') },
    toolbar: { addItem: add('toolbar.item') },
    commands: { add: add('command') },
    shortcuts: { add: add('shortcut') },
    menus: { addFrameAction: add('frame-menu.item'), addContextAction: add('context-menu.item') },
    canvas: {
      addOverlay: add('canvas.overlay'),
      addFrameOverlay: add('canvas.frame-overlay'),
      addTool: add('canvas.tool'),
      addView: add('canvas.view'),
    },
    shell: { addPane: add('shell.pane') },
    settings: { addSection: add('settings.section') },
    home: { addSection: add('home.section') },
    frames: createPluginFrames(options),
    reportError: options.reportError,
    invalidate: options.invalidate,
  }
}
