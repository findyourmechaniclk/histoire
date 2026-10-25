import type { HistoireSession } from '@histoire/sdk'
import type { Ref, ShallowRef } from 'vue'
import type { CanvasPropsOverrideController } from '../frame-props-override.js'
import type { CanvasTargetSelector } from '../frame-startup-lifecycle.js'
import type { AcquireStoryFrameOptions, StoryFrameStatus } from './acquire-story-frame.js'
import { subscribeHistoireMountEvents } from '@histoire/sdk/internal'
import { focusHistoireSearch, requestHistoireUiShow, requestHistoireUiToggle } from '@histoire/vue/internal'
import { createCanvasReplicaSession } from '../frame-replica.js'
import { createCanvasStartupReadiness, observeCanvasStartupRuntime, waitForCanvasStartup } from '../frame-startup-lifecycle.js'

/** Mutable ownership shared by one frame's startup generations and its release. */
export interface StoryFrameRuntime {
  /** Release started; every pending callback must retire. */
  closing: boolean
  /** Monotonic startup generation; older generations never publish. */
  generation: number
  /** Current session connection accepts selection and settings commands. */
  connected: boolean
  /** Runtime document that last received Matrix prop overrides. */
  overrideDocument: string
  /** Stop the current runtime state observer. */
  stop: () => void
  /** Stop relaying the current mount's focus requests. */
  stopFocus: () => void
  /** Close the current Matrix runtime observation. */
  closeObserver: () => void
}

/** Collaborators of one startup generation, owned by `acquireStoryFrame`. */
export interface StoryFrameSessionContext {
  /** Frame inputs. */
  options: AcquireStoryFrameOptions
  /** Shared ownership guards. */
  runtime: StoryFrameRuntime
  /** Isolated session currently owning the frame document. */
  session: ShallowRef<HistoireSession | undefined>
  /** Latest published status; startup is pending until `ready`. */
  status: Ref<StoryFrameStatus>
  /** Latest-intent target selection of this frame. */
  targetSelector: CanvasTargetSelector
  /** Matrix prop exchange of this frame. */
  propsOverride: CanvasPropsOverrideController
  /** Publish iframe identity to the registry. */
  registerDocument: (available?: boolean) => void
  /** Publish loading. */
  loading: () => void
  /** Publish failure. */
  fail: (error?: unknown) => void
  /** Publish a status after registry identity changed. */
  publish: (status: StoryFrameStatus, error?: unknown) => void
}

/**
 * Acquire a session for one startup generation and finish only after restored host readiness.
 * Every await is followed by a generation check: a newer `start` or a `release` retires this
 * generation, and only the generation that still owns `session` disposes it on failure.
 */
export async function startStoryFrameSession(context: StoryFrameSessionContext, version: number, signal: AbortSignal): Promise<void> {
  const { options, runtime, targetSelector } = context
  const isCurrentGeneration = () => !runtime.closing && version === runtime.generation
  const readiness = createCanvasStartupReadiness(signal)
  let current: HistoireSession | undefined
  runtime.connected = false
  targetSelector.invalidate()
  try {
    signal.throwIfAborted()
    runtime.stop()
    runtime.stopFocus()
    runtime.closeObserver()
    const previous = context.session.value
    context.session.value = undefined
    if (previous) await previous.dispose()
    signal.throwIfAborted()
    if (!isCurrentGeneration() || !options.container()) return
    const propsOverride = options.propsOverride?.()
    current = createCanvasReplicaSession(options.canonical, options.previewBase(), { matrix: !!propsOverride, nativeScroll: !!options.viewport?.() })
    context.session.value = current
    await waitForCanvasStartup(current.connect(), signal)
    if (!isCurrentGeneration()) return
    runtime.connected = true
    await waitForCanvasStartup(targetSelector.select(true, false), signal)
    const container = options.container()
    if (!isCurrentGeneration() || !container) return
    const owner = current
    const observer = !options.propsOverride?.() ? options.matrix?.registerRuntimeObserver() : undefined
    runtime.closeObserver = () => observer?.close()
    runtime.stop = observeCanvasStartupRuntime({
      owner,
      canonical: options.canonical,
      state: options.propsOverride?.() ? undefined : options.frameState,
      target: () => ({ storyId: options.target().storyId, variantId: options.target().variantId }),
      document: () => options.container()?.querySelector('iframe')?.contentDocument,
      isCurrent: () => isCurrentGeneration() && context.session.value === owner,
      isStartupPending: () => context.status.value !== 'ready',
      loading: context.loading,
      error(error) {
        context.fail(error)
        readiness.fail(error)
      },
      startupFailure: error => readiness.fail(error),
      ready(value) {
        observer?.capture(value)
        context.registerDocument(true)
        if (value.runtime.runtimeId && value.runtime.runtimeId !== runtime.overrideDocument) {
          runtime.overrideDocument = value.runtime.runtimeId
          context.propsOverride.update()
        }
        context.publish('ready')
        readiness.ready()
      },
    })
    const mount = owner.mount(container, { surface: 'preview' })
    // Generation guards keep retired mounts from targeting their former provider chrome.
    runtime.stopFocus = subscribeHistoireMountEvents(mount, (event) => {
      if (!isCurrentGeneration() || context.session.value !== owner || event.event !== 'focus.changed') return
      const action = (event.payload as { action?: string }).action
      if (action === 'search') focusHistoireSearch(options.root())
      else if (action === 'toggle-ui') requestHistoireUiToggle(options.root())
      else if (action === 'show-ui') requestHistoireUiShow(options.root())
    })
    const intent = targetSelector.currentIntent()
    const mounted = mount.ready.catch((error) => {
      // A new selection owns its own readiness; the initial mount promise retires.
      if (intent === targetSelector.currentIntent()) throw error
    })
    // The runtime reporting the target ready is authoritative: a document that
    // reloaded (e.g. after a dropped module request) reports through the session
    // while the first handshake's mount readiness only settles at its timeout.
    // That wait held the startup slot of every other queued frame. A mount
    // failure still fails startup while readiness is pending.
    const started = new Promise<void>((resolve, reject) => {
      readiness.promise.then(resolve, reject)
      mounted.catch(reject)
    })
    await waitForCanvasStartup(started, signal)
  }
  catch (error) {
    readiness.fail(error)
    if (current && context.session.value === current) {
      runtime.stop()
      runtime.stop = () => {}
      runtime.stopFocus()
      runtime.stopFocus = () => {}
      runtime.closeObserver()
      runtime.closeObserver = () => {}
      context.session.value = undefined
      runtime.connected = false
      await current.dispose().catch(() => {})
    }
    if (!signal.aborted && isCurrentGeneration()) context.fail(error)
    throw error
  }
  finally {
    readiness.dispose()
  }
}
