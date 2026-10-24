import type { HistoireSession } from '@histoire/sdk'
import type { Ref } from 'vue'
import type { CanvasFrames } from '../../../composables/canvas-settings.js'
import type { CanvasArrangement } from '../../../stores/canvas-arrangement.js'
import type { MatrixStore } from '../../../stores/matrix.js'
import type { CanvasStartupCoordinator, CanvasStartupRequest } from '../frame-startup-coordinator.js'
import type { CanvasFrameState } from '../frame-state.js'
import { useEventListener } from '@vueuse/core'
import { computed, effectScope, ref, shallowRef, watch } from 'vue'
import { createCanvasPropsOverrideController } from '../frame-props-override.js'
import { createCanvasPropsRequestId } from '../frame-requests.js'
import { createCanvasReplicaTargetSelector } from '../frame-startup-lifecycle.js'
import { matrixSandboxBootGate } from '../sandbox-boot-gate.js'
import { startStoryFrameSession, type StoryFrameRuntime } from './story-frame-session.js'

/** Startup and runtime state of one managed story frame. */
export type StoryFrameStatus = 'loading' | 'ready' | 'error'

/** Exact collected story variant rendered by a managed frame. */
export interface StoryFrameTarget {
  /** Collected story identifier. */
  storyId: string
  /** Collected variant identifier. */
  variantId: string
}

/** Presentation settings applied to an isolated frame session. */
export type StoryFrameSettings = Parameters<HistoireSession['settings']['update']>[0]

/** Inputs of one managed frame; getters are re-read on every startup and target change. */
export interface AcquireStoryFrameOptions {
  /** Canonical workbench session whose source the frame replicates. */
  canonical: HistoireSession
  /** Viewport frame registry receiving the frame document identity. */
  frames: CanvasFrames
  /** Ordinary frame-state cache; Matrix projections never publish into it. */
  frameState?: CanvasFrameState
  /** Matrix runtime observation for ordinary frames; plugin leases omit it. */
  matrix?: Pick<MatrixStore, 'registerRuntimeObserver'>
  /** Bounded selected-first startup queue; absent views start directly. */
  startup?: CanvasStartupCoordinator
  /** Stable canvas frame identifier. */
  frameId: () => string
  /** Current exact target. */
  target: () => StoryFrameTarget
  /** Configured standalone source base, independent of route. */
  previewBase: () => string
  /** Native fixed dimensions; selects direct startup and native document scrolling. */
  viewport?: () => { width: number, height: number } | undefined
  /** Matrix cell prop projection; never writes into canonical session. */
  propsOverride?: () => Record<string, unknown> | undefined
  /** Host element receiving the frame iframe. */
  container: () => HTMLElement | undefined
  /** Current presentation settings, including frame-local overrides. */
  settings: () => StoryFrameSettings
  /** Current canvas arrangement; Single starts directly. */
  arrangement: () => CanvasArrangement
  /** Workbench root receiving focus requests relayed from the frame document. */
  root: () => HTMLElement | null
  /** Called on every status publication, in the same order as the status changes. */
  onStatus?: (status: StoryFrameStatus, error?: unknown) => void
}

/** One managed frame lease; `release` ends it and is safe to call repeatedly. */
export interface StoryFrameHandle {
  /** Isolated session owning the frame document, while acquired. */
  session: Readonly<Ref<HistoireSession | undefined>>
  /** Whether host state restoration completed for the current runtime. */
  ready: Readonly<Ref<boolean>>
  /** Latest published status. */
  status: Readonly<Ref<StoryFrameStatus>>
  /** Acquire, or re-acquire after failure; resolves after readiness or cancellation. */
  start: () => Promise<void>
  /** Wait for current Matrix prop acknowledgement. */
  wait: () => Promise<void>
  /** Read dynamic source of the rendered target after prop acknowledgement. */
  getSource: () => Promise<string>
  /** Cancel startup, stop observers and dispose the owned session. */
  release: () => void
}

/**
 * Allocate one story frame: an isolated replica session mounted in `container`,
 * started through the canvas startup coordinator unless the frame is a direct one
 * (Single, native viewport, Matrix projection, or no coordinator).
 */
export function acquireStoryFrame(options: AcquireStoryFrameOptions): StoryFrameHandle {
  const session = shallowRef<HistoireSession>()
  const status = ref<StoryFrameStatus>('loading')
  // Ownership guards shared with every startup generation; see story-frame-session.ts.
  const state: StoryFrameRuntime = { closing: false, generation: 0, connected: false, overrideDocument: '', stop() {}, stopFocus() {}, closeObserver() {} }
  let directController: AbortController | undefined
  let directStartup: Promise<void> | undefined
  let startupRequest: CanvasStartupRequest | undefined
  const targetSelector = createCanvasReplicaTargetSelector({
    activation: () => ({ session: session.value, generation: state.generation, target: options.target(), connected: state.connected, closing: state.closing }),
    settings: options.settings,
    loading,
    fail,
  })
  const propsOverride = createCanvasPropsOverrideController({
    frames: options.frames,
    frameId: options.frameId,
    projection: () => ({ variantId: options.target().variantId, props: options.propsOverride?.() }),
    nextRequestId: createCanvasPropsRequestId(),
    fail,
  })

  /** Publish iframe identity for finite measure and comment requests. */
  function registerDocument(available = false): void {
    const entry = options.frames.getFrame(options.frameId())
    const iframe = options.container()?.querySelector('iframe')
    if (!entry || !iframe) return
    iframe.setAttribute('data-test-id', 'preview-iframe-passive')
    entry.iframe = iframe
    entry.documentId = available ? new URL(iframe.src).searchParams.get('documentId') : null
    entry.session = available ? session.value : undefined
  }

  /** Publish one status after registry identity changed. */
  function publish(value: StoryFrameStatus, error?: unknown): void {
    status.value = value
    options.onStatus?.(value, error)
  }

  /** Register loading geometry without granting runtime authority. */
  function loading(): void {
    registerDocument()
    publish('loading')
  }

  /** Keep failure local and release inspector/document authority. */
  function fail(error?: unknown): void {
    registerDocument()
    publish('error', error)
  }

  /** Run one owned startup generation; see story-frame-session.ts. */
  function startOwned(version: number, signal: AbortSignal): Promise<void> {
    return startStoryFrameSession({ options, runtime: state, session, status, targetSelector, propsOverride, registerDocument, loading, fail, publish }, version, signal)
  }

  /** Queue Grid/List acquisition; keep Single and Matrix lifetimes direct. */
  async function start(): Promise<void> {
    startupRequest?.cancel()
    startupRequest = undefined
    directController?.abort()
    const previousDirect = directStartup
    const version = ++state.generation
    loading()
    const startup = options.startup
    const direct = !startup || !!options.propsOverride?.() || !!options.viewport?.() || options.arrangement() === 'single'
    if (direct) {
      const controller = new AbortController()
      directController = controller
      const pending = (async () => {
        // Each direct generation waits for its predecessor's owned teardown.
        if (previousDirect) await previousDirect
        if (state.closing || version !== state.generation) return
        // Matrix cells start together: stage them so one fills the module cache.
        const release = options.propsOverride?.() ? await matrixSandboxBootGate.enter(controller.signal) : undefined
        try {
          if (state.closing || version !== state.generation) return
          await startOwned(version, controller.signal)
        }
        finally {
          release?.()
        }
      })()
      const owned = pending.catch(() => {})
      directStartup = owned
      await owned
      if (directStartup === owned) directStartup = undefined
      if (directController === controller) directController = undefined
      return
    }
    const request = startup.request(options.frameId(), async (signal) => {
      if (previousDirect) await previousDirect
      signal.throwIfAborted()
      await startOwned(version, signal)
    })
    startupRequest = request
    try {
      await request.completion
    }
    catch {}
  }

  const scope = effectScope()
  scope.run(() => {
    watch(options.settings, () => {
      if (state.connected) void session.value?.settings.update(options.settings()).catch(() => {})
    }, { deep: true })
    watch(() => [options.target().storyId, options.target().variantId], () => void targetSelector.select())
    watch(() => options.propsOverride?.(), propsOverride.update, { deep: true })
    useEventListener('message', propsOverride.receive)
  })

  /** End the lease; generation fencing retires every pending startup callback. */
  function release(): void {
    if (state.closing) return
    startupRequest?.cancel()
    startupRequest = undefined
    directController?.abort()
    directController = undefined
    state.closing = true
    state.generation++
    state.stop()
    state.stopFocus()
    state.closeObserver()
    propsOverride.dispose()
    const entry = options.frames.getFrame(options.frameId())
    const container = options.container()
    if (entry?.iframe && container?.contains(entry.iframe)) {
      entry.iframe = null
      entry.documentId = null
      entry.session = undefined
    }
    void session.value?.dispose().catch(() => {})
    scope.stop()
  }

  /** Wait for current prop acknowledgement before dynamic code generation. */
  async function getSource(): Promise<string> {
    await propsOverride.wait()
    if (!session.value || state.closing) throw new Error('Variant unavailable.')
    const target = options.target()
    return (await session.value.source.get({ storyId: target.storyId, variantId: target.variantId, mode: 'dynamic' })).body
  }

  return {
    session: computed(() => session.value),
    ready: computed(() => status.value === 'ready'),
    status: computed(() => status.value),
    start,
    wait: propsOverride.wait,
    getSource,
    release,
  }
}
