import type { HistoireBridgeCommand, HistoireEvent, HistoireSnapshot, HistoireSourceDescriptor, HistoireStateSnapshot } from '@histoire/protocol'
import type { HistoireBridgePort, HistoireSession } from '@histoire/sdk/internal'
import { HistoireSdkError, validateHistoireStateSnapshot } from '@histoire/protocol'
import { registerHistoireSessionInternals } from '@histoire/sdk/internal'
/** Surface uses canonical host snapshot and method intents; creates no controller. */
export function createParentViewSession(bridge: HistoireBridgePort, signal: AbortSignal, descriptor?: () => HistoireSourceDescriptor) {
  let snapshot: Readonly<HistoireSnapshot> | undefined
  const listeners = new Set<(value: Readonly<HistoireSnapshot>) => void>()
  const events = new Set<(event: HistoireEvent) => void>()
  /** Current host state exists only after first validated view synchronization. */
  function getSnapshot(): Readonly<HistoireSnapshot> {
    if (!snapshot) {
      throw new HistoireSdkError('NOT_CONNECTED', 'Parent snapshot unavailable')
    }
    return snapshot
  }
  /** Runtime-targeted view intents capture current host document/target. */
  function request<T>(command: HistoireBridgeCommand, payload: unknown, callerSignal?: AbortSignal, target?: import('@histoire/protocol').HistoireTarget): Promise<T> {
    const current = getSnapshot()
    return bridge.request(command, payload, { ...bridge.getOwner(), ...(current.runtime.runtimeId ? { runtimeId: current.runtime.runtimeId } : {}), ...((target ?? current.selection) ? { target: target ?? current.selection! } : {}), signal: callerSignal ? AbortSignal.any([signal, callerSignal]) : signal })
  }
  /** Canonical ACK updates existing parent mirror before replica subscribers run. */
  async function stateRequest(command: 'state.get' | 'state.patch' | 'state.reset', payload: unknown): Promise<HistoireStateSnapshot> {
    const captured = getSnapshot()
    const state = await request<HistoireStateSnapshot>(command, payload)
    validateHistoireStateSnapshot(state)
    if (!snapshot || snapshot.runtime.runtimeId !== captured.runtime.runtimeId || snapshot.source?.epoch !== captured.source?.epoch || snapshot.source?.revision !== captured.source?.revision
      || state.runtimeId !== snapshot.runtime.runtimeId || state.target.storyId !== snapshot.selection?.storyId || state.target.variantId !== snapshot.selection?.variantId) {
      throw new HistoireSdkError('RUNTIME_CHANGED', 'State acknowledgment belongs to another runtime')
    }
    snapshot = { ...snapshot, state }
    for (const listener of listeners) listener(snapshot)
    return state
  }
  const session: HistoireSession = {
    // View-only proxies do not own the document observation lifetime.
    debug: {
      getSnapshot: () => ({ items: [], nextSequence: 0, oldestSequence: 1, droppedCount: 0, gap: false }),
      clear: () => {},
      subscribe: () => {
        const ready = Promise.reject(new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Diagnostics unavailable'))
        void ready.catch(() => {})
        return { ready, closed: ready, unsubscribe: async () => {} }
      },
    },
    inspect: {
      variant: (options = {}) => inspectionRequest('inspection.variant', options),
      dom: (options = {}) => inspectionRequest('inspection.dom', options),
      components: options => inspectionRequest('inspection.components', options ?? {}),
      component: options => inspectionRequest('inspection.component', options),
      componentForElement: options => inspectionRequest('inspection.componentForElement', options),
      accessibility: options => inspectionRequest('inspection.accessibility', options ?? {}),
      highlight: options => inspectionRequest('inspection.highlight', options),
      highlightLease: options => inspectionRequest('inspection.highlightLease', options),
      clearHighlight: options => inspectionRequest('inspection.highlightClear', options),
      pick: options => inspectionRequest('inspection.pick', options),
    },
    connect: async () => {
      getSnapshot()
    },
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    catalog: { list: () => request('catalog.list', {}), getStory: storyId => request('catalog.getStory', { storyId }), search: query => request('catalog.search', { query }) },
    selection: { select: input => request('selection.select', input) },
    state: {
      get: () => stateRequest('state.get', {}),
      patch: async (patch) => {
        await stateRequest('state.patch', patch)
      },
      reset: async () => {
        await stateRequest('state.reset', {})
      },
    },
    settings: { update: patch => request('settings.update', patch) },
    events: { subscribe(listener) {
      events.add(listener)
      return () => {
        events.delete(listener)
      }
    }, clear() {
      void request('events.clear', {}).catch(() => {
      })
    } },
    docs: { get: storyId => request('docs.get', { storyId }) },
    channels: { open: () => { throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Application channels belong to parent session') } },
    source: { get: input => request('source.get', input) },
    tests: { collect: () => request('tests.collect', {}), run: options => request('tests.run', { mode: options.mode }, options.signal) },
    mount: () => {
      throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Nested surface mounting unavailable')
    },
    createHiddenPreview: () => {
      throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Nested runtime mounting unavailable')
    },
    dispose: async () => {
    },
  }
  /** Capture target before handing the intent to the parent port. */
  function inspectionRequest(command: 'inspection.variant' | 'inspection.dom' | 'inspection.highlight' | 'inspection.highlightLease' | 'inspection.highlightClear' | 'inspection.pick' | 'inspection.components' | 'inspection.component' | 'inspection.componentForElement' | 'inspection.accessibility', options: any): Promise<any> {
    const { signal: callerSignal, ...input } = options
    const target = input.target ?? getSnapshot().selection
    return request(command, { ...input, target }, callerSignal, target)
  }
  registerHistoireSessionInternals(session, {
    descriptor() {
      if (!descriptor) throw new HistoireSdkError('NOT_CONNECTED', 'Source metadata unavailable')
      getSnapshot()
      return structuredClone(descriptor())
    },
    presets: input => request('controls.preset', input),
    openInEditor: target => request('openInEditor', target),
  })
  return {
    session,
    /** Shared envelope validator has already checked bounded snapshot shape. */
    synchronize(value: HistoireSnapshot) {
      const sameOwner = snapshot?.runtime.runtimeId === value.runtime.runtimeId && snapshot?.selection?.storyId === value.selection?.storyId && snapshot?.selection?.variantId === value.selection?.variantId && snapshot?.source?.epoch === value.source?.epoch
      snapshot = sameOwner ? { ...value, events: snapshot!.events } : value
      for (const listener of listeners) {
        listener(snapshot)
      }
    },
    /** Deliver bounded future host events separately from view synchronization. */
    event(value: HistoireEvent) {
      if (!snapshot || value.runtimeId !== snapshot.runtime.runtimeId || value.target.storyId !== snapshot.selection?.storyId) return
      snapshot = { ...snapshot, events: { ...snapshot.events, items: [...snapshot.events.items, value].slice(-1000) } }
      for (const listener of listeners) listener(snapshot)
      for (const listener of events) listener(value)
    },
    /** Parent clear/initial replay resets history without fabricating a runtime operation. */
    clearEvents(droppedCount = 0) {
      if (!snapshot) return
      snapshot = { ...snapshot, events: { items: [], droppedCount } }
      for (const listener of listeners) listener(snapshot)
    },
    /** Loss deltas follow retained reset separately, preserving canonical bounded history count. */
    dropEvents(count: number) {
      if (!snapshot) return
      snapshot = { ...snapshot, events: { ...snapshot.events, droppedCount: snapshot.events.droppedCount + count } }
      for (const listener of listeners) listener(snapshot)
    },
    /** Own proxy observations only; parent controller remains caller-owned. */
    close() {
      listeners.clear()
      events.clear()
      snapshot = undefined
    },
  }
}
