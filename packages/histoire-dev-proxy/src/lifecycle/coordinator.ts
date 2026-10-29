import type { RuntimeStatus } from '../protocol.js'
import { randomUUID } from 'node:crypto'
import { waitForRuntimeWork } from './wait.js'

/** Minimal resource required by shared restart ownership. */
export interface LifecycleGeneration {
  /** Initial work whose completion permits publication. */
  ready: Promise<void>
  /** Releases all acquired resources. */
  close: () => Promise<void>
  /** Optional live collection metadata retained by Histoire adapters. */
  collectionOutcomes?: unknown
}
/** A resource fenced by coordinator generation identity. */
export type LifecycleHandle<G> = G & { epoch: string, isActive: () => boolean }
/** Framework-neutral acquisition, observation and cleanup policy. */
export interface CoordinatorOptions<G extends LifecycleGeneration> {
  /** CLI process owner can cancel acquisition; SDK compatibility keeps historical joining. */
  interruptStartup?: boolean
  /** Acquires one runtime, responding to cancellation. */
  acquire: (signal: AbortSignal, isActive: () => boolean) => Promise<G>
  /** Optional compatibility adapter; CLI proxy supplies its persistent watcher separately. */
  watch?: (runtime: G, restart: (source: string) => void) => Promise<() => Promise<void>>
  /** Attaches generation-owned services before readiness. */
  onGeneration?: (handle: LifecycleHandle<G>) => void | Promise<void>
  /** Drains dependents after ownership invalidation. */
  onBeforeRelease?: (handle: LifecycleHandle<G>) => void | Promise<void>
  /** Reports asynchronous watcher failures. */
  onError?: (error: unknown) => void
  /** Marks failures after which ownership cannot safely transfer. */
  isUnsafeCleanup: (error: unknown) => boolean
  /** Bounds cleanup using owning framework's error contract. */
  withDeadline: <T>(promise: Promise<T>) => Promise<T>
}

/** Serializes startup/restart and suppresses feedback from superseded generations. */
export function createRestartCoordinator<G extends LifecycleGeneration>(options: CoordinatorOptions<G>) {
  const acquire = options.acquire
  const watch = options.watch ?? (async () => () => Promise.resolve())
  const listeners = new Set<(status: RuntimeStatus, handle?: LifecycleHandle<G>) => void>()
  let status: RuntimeStatus = 'starting'
  let current: LifecycleHandle<G> | undefined
  let generation: G | undefined
  let disposeWatch: (() => Promise<void>) | undefined
  let abort: AbortController | undefined
  let transition: Promise<LifecycleHandle<G>> | undefined
  let closing: Promise<void> | undefined
  let pendingRestart = false
  let acquiring = false
  let unsafeCleanupError: unknown
  let version = 0

  /** Announces lifecycle changes after state has been updated. */
  function publish(next: RuntimeStatus) {
    status = next
    for (const listener of listeners) listener(status, current)
  }

  /** Invalidates ownership before closing watchers and server resources. */
  async function release() {
    acquiring = false
    version++
    abort?.abort(new Error('Project runtime closed'))
    const oldHandle = current
    current = undefined
    const oldGeneration = generation
    const oldWatch = disposeWatch
    generation = undefined
    disposeWatch = undefined
    try {
      if (oldHandle) await options.onBeforeRelease?.(oldHandle)
    }
    catch (error) {
      unsafeCleanupError = error
      // Quarantine this controller after unknown runner teardown; closing
      // remaining project resources still avoids watcher/server leaks.
      await Promise.allSettled([oldWatch?.(), oldGeneration?.close()])
      throw error
    }
    const results = await Promise.allSettled([oldWatch?.(), oldGeneration?.close()])
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (failure) {
      unsafeCleanupError = failure.reason
      throw failure.reason
    }
  }

  /** Creates a fresh generation; late acquisition is closed before returning. */
  async function initialize(): Promise<LifecycleHandle<G>> {
    acquiring = true
    const capturedVersion = ++version
    const active = () => status !== 'closed' && capturedVersion === version
    const localAbort = new AbortController()
    abort = localAbort
    let runtime: G | undefined
    try {
      runtime = await acquire(localAbort.signal, active)
      if (!active()) {
        try {
          await runtime.close()
        }
        catch (error) {
          unsafeCleanupError = error
          throw error
        }
        throw new Error('Project runtime closed')
      }
      generation = runtime
      // Preserve live getters (backend handoff/catalog outcomes) instead of
      // freezing their acquisition-time values through object spread.
      const handle = Object.defineProperties({}, {
        ...Object.getOwnPropertyDescriptors(runtime),
        epoch: { value: randomUUID(), enumerable: true },
        isActive: { value: active, enumerable: true },
      }) as LifecycleHandle<G>
      current = handle
      await options.onGeneration?.(handle)
      if (!active()) throw new Error('Project runtime closed')
      const stopWatch = await watch(runtime, (source) => {
        void restart(source).catch(error => options.onError?.(error))
      })
      if (!active()) {
        try {
          await stopWatch()
        }
        catch (error) {
          unsafeCleanupError = error
          throw error
        }
        throw new Error('Project runtime closed')
      }
      disposeWatch = stopWatch
      // Abort wins even if project execution never settles its readiness work.
      await waitForRuntimeWork(runtime.ready, localAbort.signal)
      if (!active()) throw new Error('Project runtime closed')
      // Reconciliation may have queued a successor while this watcher became
      // ready. Let finishTransitions retire this stale generation unexposed.
      if (!pendingRestart) publish('ready')
      return handle
    }
    catch (error) {
      if (options.isUnsafeCleanup(error)) unsafeCleanupError = error
      if (active()) {
        let cleanupError: unknown
        try {
          await release()
        }
        catch (failure) {
          cleanupError = failure
        }
        finally {
          publish(pendingRestart ? 'restarting' : 'failed')
        }
        if (cleanupError) throw new AggregateError([error, cleanupError], String(error))
      }
      throw error
    }
    finally {
      if (capturedVersion === version) acquiring = false
    }
  }

  /** Repeats once when a config edit lands after the next config was acquired. */
  async function finishTransitions(first: Promise<LifecycleHandle<G>>) {
    let handle: LifecycleHandle<G> | undefined
    let next = first
    for (;;) {
      try {
        handle = await next
      }
      catch (error) {
        if (!pendingRestart || unsafeCleanupError || status === 'closed') throw error
      }
      if (!pendingRestart || status === 'closed') return handle!
      pendingRestart = false
      const released = release()
      publish('restarting')
      next = released.then(() => initialize())
    }
  }

  /** Records teardown failures as terminal lifecycle failures, including restarts. */
  function observeTransition(work: Promise<LifecycleHandle<G>>) {
    return work.catch((error) => {
      if (status !== 'closed' && status !== 'failed') publish('failed')
      throw error
    }).finally(() => {
      transition = undefined
    })
  }

  /** Starts once, or joins an in-progress generation transition. */
  function start() {
    if (status === 'closed') return Promise.reject(new Error('Project runtime closed'))
    if (unsafeCleanupError) return Promise.reject(unsafeCleanupError)
    if (current && status === 'ready') return Promise.resolve(current)
    if (transition) return transition
    publish('starting')
    transition = observeTransition(finishTransitions(initialize()))
    return transition
  }

  /** Coalesces edits received during one teardown/startup into one restart. */
  function restart(_source?: string) {
    if (status === 'closed') return Promise.reject(new Error('Project runtime closed'))
    if (unsafeCleanupError) return Promise.reject(unsafeCleanupError)
    if (transition) {
      // Edits before a next generation is acquired already use its fresh config.
      // Edits after acquisition must restart again to avoid losing a config edit.
      if (current || (options.interruptStartup && acquiring)) pendingRestart = true
      if (options.interruptStartup && acquiring) abort?.abort(new Error('Runtime superseded by config change'))
      return transition
    }
    const released = release()
    publish('restarting')
    transition = observeTransition(finishTransitions((async () => {
      await released
      return initialize()
    })()))
    return transition
  }

  return {
    /** Current lifecycle state, usable before a catalog exists. */
    get status() {
      return status
    },
    /** Current private handle; undefined during teardown or after failure. */
    get current() {
      return current
    },
    start,
    restart,
    /** Joins the next completed ready generation. */
    waitForReady: start,
    /** Registers lifecycle observations; caller owns returned disposer. */
    subscribe(listener: (status: RuntimeStatus, handle?: LifecycleHandle<G>) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** Stops admission immediately and releases acquired resources once. */
    close() {
      if (!closing) {
        publish('closed')
        const released = release()
        // Acquisition may ignore its signal. Join late acquisition until its
        // resources close, while unrelated project controllers remain usable.
        closing = options.withDeadline(Promise.all([released, transition?.catch(() => {
        })])).then(() => {
          if (unsafeCleanupError) throw unsafeCleanupError
        }).finally(() => {
          listeners.clear()
        })
      }
      return closing
    },
  }
}
