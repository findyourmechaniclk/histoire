import type { ContributionContext, ContributionKind, ExtensionHost, FrameScopedContext, NavigationService, QualifiedContribution, SessionContext, WorkbenchContext } from '@histoire/plugin-kit'
import type { HistoireSession } from '@histoire/sdk'
import type { InjectionKey } from 'vue'
import type { createHistoirePanelNavigation } from './panels.js'
import { createSessionContext, createSessionFrameService, createSessionNavigation } from '@histoire/plugin-kit'
import { getHistoireTargetKey } from '@histoire/protocol'
import { computed, provide, shallowRef, watch } from 'vue'

/** Extension host binding nested providers inherit when they get no `extensions` prop. */
export interface HistoireExtensionsBinding {
  /** Nearest caller-owned extension host, if any. */
  readonly host: ExtensionHost | undefined
}

/** Injection key of the inherited extension host (nested selected-frame providers reuse it). */
export const histoireExtensionsKey: InjectionKey<HistoireExtensionsBinding> = Symbol('HistoireExtensions')

/**
 * Hands a caller-owned host to descendant providers without an `extensions` prop. First-party
 * workbenches that create their host below their root provider call this.
 * @param host Host, or a getter of the current host.
 */
export function provideHistoireExtensions(host: ExtensionHost | undefined | (() => ExtensionHost | undefined)): void {
  const read = typeof host === 'function' ? host : () => host
  provide(histoireExtensionsKey, { get host() {
    return read()
  } })
}

/** Plugin surfaces of one provider: host, surface contexts and reactive registry reads. */
export interface HistoireProviderExtensions {
  /** Caller-owned host (own prop or inherited); never disposed by the provider. */
  readonly host: ExtensionHost | undefined
  /** Whether the host received the provider's `extensions` prop (binds keyboard shortcuts). */
  readonly owned: boolean
  /** Whether every plugin setup settled. */
  readonly ready: boolean
  /** Root surface context (toolbar, commands, shortcuts) of the current session. */
  readonly context: WorkbenchContext | undefined
  /** Inspector context of the selected variant, `undefined` without one. */
  readonly frame: FrameScopedContext | undefined
  /** Ordered available contributions; Vue-tracked (registry, context and readiness changes). */
  available: <K extends ContributionKind>(kind: K, context: ContributionContext<K> | undefined) => ReadonlyArray<QualifiedContribution<K>>
  /** Runs an action against `context` with the current selection scope captured. */
  run: (contributionId: string, context: unknown) => Promise<void>
}

/** Inputs of {@link createProviderExtensions}. */
export interface ProviderExtensionsOptions {
  /** Explicit `extensions` prop. */
  own: () => ExtensionHost | undefined
  /** Inherited host binding. */
  inherited: HistoireExtensionsBinding | undefined
  /** Current caller session. */
  session: () => HistoireSession
  /** Provider-local panel navigation receiving inspector tab requests. */
  panels: ReturnType<typeof createHistoirePanelNavigation>
}

/**
 * Builds a native navigation: stories through the session, inspector tabs through this
 * provider's explorer panels; panes, settings and canvas views do not exist in native hosts
 * and are ignored, so plugins never change host-owned URLs.
 */
function createNativeNavigation(session: HistoireSession, panels: ProviderExtensionsOptions['panels']): NavigationService {
  return Object.freeze({ ...createSessionNavigation(session), openInspectorTab: (id: string) => panels.requestTab(id) })
}

/**
 * Plugin wiring of one provider. Surface contexts are rebuilt per session generation (session
 * replacement closes the old one; its views unmount with the provider content); the host is
 * caller-owned and only observed, never disposed.
 * @param options Host sources, session and panel navigation.
 */
export function createProviderExtensions(options: ProviderExtensionsOptions) {
  const host = computed(() => options.own() ?? options.inherited?.host)
  // Registry snapshots are not reactive: host and context notifications bump this revision.
  const revision = shallowRef(0)
  const ready = shallowRef(false)
  // Bumped when the host or the session context changes: surface contexts are rebuilt.
  const generation = shallowRef(0)
  const selection = shallowRef(options.session().getSnapshot().selection)
  let session: SessionContext | undefined

  /** Creates the surface context of the current session, with frames when the session has them. */
  function open(): SessionContext {
    const current = options.session()
    const plugins = current.plugins
    const created = createSessionContext({ session: current, navigation: createNativeNavigation(current, options.panels), frames: plugins ? createSessionFrameService(plugins) : undefined })
    created.context.subscribe(() => revision.value++)
    return created
  }

  const stopHost = watch(host, (value, _previous, onCleanup) => {
    ready.value = false
    revision.value++
    generation.value++
    if (!value) return
    let active = true
    const stop = value.subscribe(() => revision.value++)
    void value.ready.then(() => {
      if (active) ready.value = true
    })
    onCleanup(() => {
      active = false
      stop()
    })
  }, { immediate: true, flush: 'sync' })

  /** Surface context, created on first use so providers without plugins subscribe nothing. */
  function root(): SessionContext | undefined {
    if (!host.value) return undefined
    return session ??= open()
  }

  // Equal keys stop propagation: the frame context changes object only when the target does,
  // so views receive updates, never remounts, for unrelated snapshot publications.
  const targetKey = computed(() => selection.value?.variantId ? getHistoireTargetKey(selection.value) : '')
  const frame = computed((): FrameScopedContext | undefined => {
    void generation.value
    const context = root()?.context
    const target = selection.value
    if (!context || !targetKey.value || !target?.variantId) return undefined
    const current = options.session()
    const frameTarget = Object.freeze({ storyId: target.storyId, variantId: target.variantId })
    return Object.freeze({
      ...context,
      selection: context.selection,
      frame: Object.freeze({ key: targetKey.value, target: frameTarget }),
      runtime: Object.freeze({ getSnapshot: () => current.getSnapshot(), subscribe: (listener: Parameters<HistoireSession['subscribe']>[0]) => current.subscribe(listener) }),
    })
  })

  const state: HistoireProviderExtensions = {
    get host() {
      return host.value
    },
    get owned() {
      return !!options.own()
    },
    get ready() {
      return ready.value
    },
    get context() {
      void generation.value
      return root()?.context
    },
    get frame() {
      return frame.value
    },
    available(kind, context) {
      void revision.value
      const value = host.value
      return value && context ? value.available(kind, context) : []
    },
    run(contributionId, context) {
      const value = host.value
      if (!value) return Promise.reject(new Error('[histoire] no extension host'))
      return value.run(contributionId, context, { signal: root()?.selectionSignal() })
    },
  }

  return {
    state,
    /** Publishes the provider's latest snapshot selection. */
    synchronize(value: ReturnType<HistoireSession['getSnapshot']>): void {
      selection.value = value.selection
    },
    /** Session replacement: retire the old surface context; the host stays. */
    replace(): void {
      session?.close()
      session = undefined
      selection.value = options.session().getSnapshot().selection
      revision.value++
      generation.value++
    },
    /** Provider teardown: stop observing; never dispose the caller's host. */
    close(): void {
      stopHost()
      session?.close()
      session = undefined
    },
  }
}
