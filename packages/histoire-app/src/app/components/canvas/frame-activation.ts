import type { HistoireSession } from '@histoire/sdk'
import type { CanvasFrames } from '../../composables/canvas-settings.js'
import { nextTick } from 'vue'

/** Inputs of in-frame click activation. */
export interface CanvasFrameActivationOptions {
  /** Viewport frame registry, including leased frames. */
  registry: CanvasFrames
  /** Canonical snapshot. */
  snapshot: () => ReturnType<HistoireSession['getSnapshot']>
  /** Matrix or collection failures: no activation. */
  unavailable: () => boolean
  /** Canonical selection action, reporting its own failures. */
  select: (target: { storyId: string, variantId: string }) => Promise<void>
}

/**
 * Select a ready frame clicked inside its document, without moving the camera: the frame
 * activated this way is skipped once by selection reveal.
 */
export function createCanvasFrameActivation(options: CanvasFrameActivationOptions) {
  let activatedFrameId: string | undefined

  /** Select another ready preview while leaving its original click untouched. */
  function activate(iframe: HTMLIFrameElement): void {
    const snapshot = options.snapshot()
    if (options.unavailable() || snapshot.stale) return
    const entry = [...options.registry.frames.values()].find(frame => frame.iframe === iframe)
    const selected = snapshot.selection
    if (!entry || (entry.storyId === selected?.storyId && entry.variantId === selected.variantId)) return
    const state = entry.session?.getSnapshot()
    if (!state || state.stale || state.runtime.status !== 'ready' || state.selection?.storyId !== entry.storyId || state.selection.variantId !== entry.variantId) return
    const targetId = entry.id
    activatedFrameId = targetId
    void options.select({ storyId: entry.storyId, variantId: entry.variantId }).finally(async () => {
      await nextTick()
      if (activatedFrameId === targetId) activatedFrameId = undefined
    })
  }

  /** Whether selection reveal may move to `frameId`; consumes a pending in-frame activation. */
  function shouldReveal(frameId: string): boolean {
    if (activatedFrameId !== frameId) return true
    activatedFrameId = undefined
    return false
  }

  return { activate, shouldReveal }
}
