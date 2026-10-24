// Workbench-side audit state: one channel per attached frame actor. Framework-free.
import type { Disposer, PluginChannel, PluginFrameRef, WorkbenchPluginApi } from '@histoire/plugin-kit'
import type { AuditReport } from './audit.js'
import type { HighlightMessage } from './messages.js'
import { REFERENCE_MESSAGES } from './messages.js'

/** Audit state of one frame. */
export interface FrameAudit {
  /** Frame and the actor its channel is bound to. */
  readonly frame: PluginFrameRef
  /** Latest report, `null` until the frame answered. */
  readonly report: AuditReport | null
}

/** Live entry; `channel` stays private to the store. */
interface Entry extends FrameAudit {
  /** Channel bound to `frame.actorId`. */
  channel: PluginChannel
  /** Mutable report slot. */
  report: AuditReport | null
}

/** Totals across every attached frame. */
export interface AuditTotals {
  /** Frames with a report. */
  frames: number
  /** Issues across those frames. */
  issues: number
}

/**
 * Tracks frames running the reference frame module and their latest reports.
 *
 * While a view observes the store, it reconciles `api.frames.list()` whenever
 * `api.frames.subscribe` reports an attach or detach. Each new actor gets its own channel (bound
 * to that exact actor; it never retargets) and an `audit` request, because reports posted before
 * the channel opened were dropped. Retired actors drop out on the next reconcile; their channels
 * are released by the host, and everything is released with the plugin.
 * @param api Plugin API of the owning extension host.
 */
export function createAuditStore(api: Pick<WorkbenchPluginApi, 'frames' | 'signal' | 'reportError'>) {
  const entries = new Map<string, Entry>()
  const listeners = new Set<() => void>()
  /** Frame attach/detach subscription, held only while the store is observed. */
  let stopFrames: Disposer | undefined
  /** Frozen list handed to views; rebuilt on change so React/Svelte snapshots compare by identity. */
  let snapshot: readonly FrameAudit[] = []

  /** Rebuilds the snapshot and notifies observers. */
  function notify(): void {
    snapshot = Object.freeze([...entries.values()].map(({ frame, report }) => Object.freeze({ frame, report })))
    for (const listener of [...listeners]) listener()
  }

  /**
   * Opens a channel to a newly attached actor.
   * @param frame Attached frame from `api.frames.list()`.
   */
  function track(frame: PluginFrameRef): void {
    let channel: PluginChannel
    try {
      channel = api.frames.open(frame)
    }
    catch {
      // The actor retired between `list()` and `open()`; the next reconcile sees its successor.
      return
    }
    const entry: Entry = { frame, channel, report: null }
    entries.set(frame.key, entry)
    channel.on(REFERENCE_MESSAGES.report, (data) => {
      // A replaced actor's late report must not overwrite its successor's.
      if (entries.get(frame.key) !== entry) return
      entry.report = data as AuditReport
      notify()
    })
    channel.post(REFERENCE_MESSAGES.audit, null).catch(() => {})
  }

  /** Reconciles entries with the attached actors. */
  function sync(): void {
    if (api.signal.aborted) return
    const frames = api.frames.list()
    const live = new Set(frames.map(frame => frame.key))
    let changed = false
    for (const frame of frames) {
      if (entries.get(frame.key)?.frame.actorId === frame.actorId) continue
      entries.delete(frame.key)
      track(frame)
      changed = true
    }
    for (const key of entries.keys()) {
      if (!live.has(key)) {
        entries.delete(key)
        changed = true
      }
    }
    if (changed) notify()
  }

  /**
   * Posts to one frame's actor; failures (actor retired meanwhile) are reported, never thrown.
   * @param key Frame key.
   * @param type Message type.
   * @param data JSON payload.
   */
  function post(key: string, type: string, data: HighlightMessage | null): void {
    entries.get(key)?.channel.post(type, data).catch(error => api.reportError(error))
  }

  api.signal.addEventListener('abort', () => {
    stopFrames?.()
    listeners.clear()
    entries.clear()
  }, { once: true })

  return {
    /** Every tracked frame, in attach order. */
    list: (): readonly FrameAudit[] => snapshot,
    /**
     * Audit of one frame.
     * @param key Frame key (`context.frame.key`).
     */
    get: (key: string): FrameAudit | undefined => snapshot.find(audit => audit.frame.key === key),
    /** Totals across tracked frames. */
    totals(): AuditTotals {
      const reported = snapshot.filter(audit => audit.report)
      return { frames: reported.length, issues: reported.reduce((sum, audit) => sum + audit.report!.issues.length, 0) }
    },
    /**
     * Asks one frame, or every tracked frame, to audit again.
     * @param key Frame key; all frames when omitted.
     */
    rerun(key?: string): void {
      sync()
      for (const entryKey of key === undefined ? [...entries.keys()] : [key]) post(entryKey, REFERENCE_MESSAGES.audit, null)
    },
    /**
     * Outlines the element of one issue inside its frame.
     * @param key Frame key.
     * @param index Issue index in the frame's report.
     */
    highlight: (key: string, index: number) => post(key, REFERENCE_MESSAGES.highlight, { index }),
    /**
     * Observes changes; the first observer starts following frame attach/detach, the last one
     * stops it.
     * @param listener Called after any change.
     */
    subscribe(listener: () => void): Disposer {
      if (api.signal.aborted) return () => {}
      listeners.add(listener)
      stopFrames ??= api.frames.subscribe(sync)
      sync()
      return () => {
        listeners.delete(listener)
        if (!listeners.size) {
          stopFrames?.()
          stopFrames = undefined
        }
      }
    },
  }
}

/** Audit store of one plugin instance. */
export type AuditStore = ReturnType<typeof createAuditStore>
