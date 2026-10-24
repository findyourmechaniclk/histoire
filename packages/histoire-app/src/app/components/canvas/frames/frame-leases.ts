import type { FrameLease, FrameLeaseFailureReason, FrameLeaseOptions, FrameRef } from '@histoire/plugin-kit'
import type { HistoireRect, HistoireTarget } from '@histoire/protocol'
import type { HistoireSession } from '@histoire/sdk'
import type { Ref } from 'vue'
import type { CanvasFrames } from '../../../composables/canvas-settings.js'
import type { createContextMenu } from '../../../composables/context-menu.js'
import type { CanvasStartupCoordinator } from '../frame-startup-coordinator.js'
import type { StoryFrameSettings } from './acquire-story-frame.js'
import type { CanvasFrameLedger } from './frame-ledger.js'
import { shallowRef, watch } from 'vue'
import { isFrameMenuShortcut, openFrameMenu } from '../frame-menu.js'
import { acquireStoryFrame } from './acquire-story-frame.js'

/** Collaborators of one viewport's plugin frame leases. */
export interface CanvasFrameLeasesOptions {
  /** Canonical workbench session whose source leased frames replicate. */
  canonical: HistoireSession
  /** Viewport frame registry; every lease registers its own frame there. */
  frames: CanvasFrames
  /** Viewport budget; leases are optional reservations that never take the selected frame's slot. */
  ledger: CanvasFrameLedger
  /** Viewport startup queue, read when a lease starts. */
  startup: () => CanvasStartupCoordinator | undefined
  /** Configured standalone source base. */
  previewBase: () => string
  /** Canonical presentation settings applied to leased frames. */
  settings: () => StoryFrameSettings
  /** Workbench root receiving focus requests relayed from frame documents. */
  root: () => HTMLElement | null
  /** Workbench context menu; container right-clicks open the frame menu of the lease. */
  menu?: ReturnType<typeof createContextMenu>
}

/** Plugin frame leases of one canvas viewport. */
export interface CanvasFrameLeases {
  /** Frame keys of granted leases in grant order; CanvasViewport appends them to the startup order. */
  ids: Readonly<Ref<readonly string[]>>
  /**
   * Acquire one managed frame; see `CanvasService.acquireFrame`. `keep` slots must stay free
   * for visible admission (default 1, the selected frame); custom views pass 0 because no
   * visible frames render beside them.
   */
  acquire: (target: HistoireTarget, options: FrameLeaseOptions, keep?: number) => Promise<FrameLease>
  /** Release every lease and reject queued requests (`unavailable`). */
  dispose: () => void
}

/** Lease request waiting for a free budget slot. */
interface QueuedLease {
  /** Ledger owner and frame key. */
  key: string
  /** Slots kept free for visible admission. */
  keep: number
  /** Grant with the slot reserved for it. */
  grant: (unreserve: () => void) => void
  /** Reject without granting. */
  reject: (reason: FrameLeaseFailureReason) => void
}

/** Prefix of leased frame keys (`lease:<n>`) in the viewport frame registry. */
export const LEASE_FRAME_PREFIX = 'lease:'

// Keys stay unique across viewport remounts, so a stale FrameRef never aliases a new lease.
let leaseSequence = 0

/** Build a `FrameLeaseError` rejection. */
function leaseError(reason: FrameLeaseFailureReason): Error {
  const messages: Record<FrameLeaseFailureReason, string> = { budget: 'Frame budget exhausted', released: 'Frame lease released', unavailable: 'Canvas unavailable' }
  return Object.assign(new Error(messages[reason]), { name: 'FrameLeaseError', reason })
}

/**
 * Create the plugin frame leases of one viewport. Each lease reserves one ledger slot (denied
 * or queued when only the selected frame's slot is left), registers its own frame in the
 * registry so pointer relays, overlays and menus see it, and starts through the startup
 * coordinator behind visible frames. Must run inside the viewport's effect scope.
 */
export function createCanvasFrameLeases(options: CanvasFrameLeasesOptions): CanvasFrameLeases {
  const ids = shallowRef<readonly string[]>([])
  const queue: QueuedLease[] = []
  const active = new Set<() => void>()
  let disposed = false
  let draining = false

  /** Grant queued requests in order while slots are free; reservation happens synchronously. */
  function drain(): void {
    // Reserving changes `available`, whose sync watcher calls back here: one drain at a time.
    if (draining) return
    draining = true
    try {
      // `dispose` empties the queue, which also ends this loop.
      while (queue.length) {
        const unreserve = options.ledger.tryReserve(queue[0].key, queue[0].keep)
        if (!unreserve) return
        queue.shift()!.grant(unreserve)
      }
    }
    finally {
      draining = false
    }
  }
  // Slots free up when leases or the Matrix primary release, or when the budget grows.
  watch(options.ledger.available, drain, { flush: 'sync' })

  /**
   * Grant one lease: register, start. Takes over the slot reserved for it, so no other
   * request can claim that slot in between.
   */
  function grant(key: string, target: HistoireTarget, request: FrameLeaseOptions, unreserve: () => void): FrameLease {
    const container = request.container
    const rect: HistoireRect = request.rect ?? { x: 0, y: 0, width: container.clientWidth, height: container.clientHeight }
    const unregister = options.frames.registerFrame({ id: key, storyId: target.storyId, variantId: target.variantId, rect: { ...rect } })
    const frame: FrameRef = Object.freeze({ key, target: Object.freeze({ storyId: target.storyId, variantId: target.variantId }) })
    let failure: unknown
    const handle = acquireStoryFrame({
      canonical: options.canonical,
      frames: options.frames,
      startup: options.startup(),
      frameId: () => key,
      target: () => frame.target as { storyId: string, variantId: string },
      previewBase: options.previewBase,
      container: () => container,
      settings: options.settings,
      // Leases always queue behind visible frames, whatever the arrangement.
      arrangement: () => 'grid',
      root: options.root,
      onStatus: (_status, error) => failure = error,
    })

    /** Open the frame menu of exactly this lease. */
    function menu(event: MouseEvent | KeyboardEvent): void {
      if (event instanceof KeyboardEvent && !isFrameMenuShortcut(event)) return
      openFrameMenu(options.menu, event, { storyId: target.storyId, variantId: target.variantId, frameKey: key })
    }
    container.addEventListener('contextmenu', menu)
    container.addEventListener('keydown', menu)

    let released = false
    /** End the lease exactly once: cancel startup, dispose the session, free registry and slot. */
    function release(): void {
      if (released) return
      released = true
      active.delete(release)
      request.signal?.removeEventListener('abort', release)
      container.removeEventListener('contextmenu', menu)
      container.removeEventListener('keydown', menu)
      handle.release()
      unregister()
      ids.value = ids.value.filter(id => id !== key)
      unreserve()
    }
    active.add(release)
    request.signal?.addEventListener('abort', release, { once: true })
    // Order must contain the key before the coordinator drains the request.
    ids.value = [...ids.value, key]
    // `start` settles after readiness, cancellation or failure; status tells them apart.
    const ready = handle.start().then(() => {
      if (released) throw leaseError('released')
      if (handle.status.value !== 'ready') throw failure ?? new Error('Variant unavailable')
    })
    // Plugins that never await readiness must not surface unhandled rejections.
    ready.catch(() => {})
    return { frame, ready, release }
  }

  return {
    ids,
    acquire(target, request, keep = 1) {
      if (disposed) return Promise.reject(leaseError('unavailable'))
      if (request.signal?.aborted) return Promise.reject(leaseError('released'))
      const key = `${LEASE_FRAME_PREFIX}${++leaseSequence}`
      const unreserve = options.ledger.tryReserve(key, keep)
      if (unreserve) return Promise.resolve(grant(key, target, request, unreserve))
      if (!request.queue) return Promise.reject(leaseError('budget'))
      return new Promise<FrameLease>((resolve, reject) => {
        /** Withdraw before grant; a granted lease handles abort itself. */
        const withdraw = (): void => queue.find(queued => queued.key === key)?.reject('released')
        const entry: QueuedLease = {
          key,
          keep,
          grant(unreserve) {
            request.signal?.removeEventListener('abort', withdraw)
            resolve(grant(key, target, request, unreserve))
          },
          reject(reason) {
            const index = queue.indexOf(entry)
            if (index < 0) return
            queue.splice(index, 1)
            request.signal?.removeEventListener('abort', withdraw)
            reject(leaseError(reason))
          },
        }
        queue.push(entry)
        request.signal?.addEventListener('abort', withdraw, { once: true })
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const entry of [...queue]) entry.reject('unavailable')
      for (const release of [...active]) release()
    },
  }
}
