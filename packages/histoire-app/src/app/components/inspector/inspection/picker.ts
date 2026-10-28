import type { CanvasScopedContext, CanvasToolPointerEvent, WorkbenchPluginApi } from '@histoire/plugin-kit'
import type { HistoireInspectionOwner } from '@histoire/protocol'
import type { HistoireSession } from '@histoire/sdk'
import type { Ref } from 'vue'
import type { FrameContextHandle } from '../../../extensions/frame-context.js'
import { HistoireSdkError, sameInspectionOwner } from '@histoire/protocol'
import { getHistoireSessionDescriptor } from '@histoire/sdk/internal'
import { captureInspectionFrame } from './frame-owner.js'

/** Detached pick result, tied to the frame and document that produced it. */
export interface InspectionPick {
  /** Selected CSS locator, absent when no element matched. */
  selector?: string
  /** Short feedback when selection failed. */
  message?: string
  /** Whether feedback describes a failed action. */
  failed?: boolean
  /** Owner that produced the result. */
  owner: HistoireInspectionOwner
  /** Exact canvas frame, including duplicate variants. */
  frameKey: string
}

/** Own one finite picker gesture; never retarget or mount another frame. */
export function createInspectionPicker(api: WorkbenchPluginApi, source: HistoireSession, current: Readonly<Ref<HistoireSession>>, selected: () => FrameContextHandle | null, publish: (pick: InspectionPick) => void) {
  let pending: AbortController | undefined
  let generation = 0
  /** Cancel only this tool's pending work. */
  function cancel() {
    generation++
    pending?.abort()
    pending = undefined
  }
  /** Recheck source policy and actor identity even when a removed tool receives a late event. */
  function allowed(session: HistoireSession, owner: HistoireInspectionOwner): boolean {
    const root = source.getSnapshot()
    try {
      return root.status === 'ready' && !root.stale && root.source?.sourceId === owner.sourceId && root.source?.epoch === owner.epoch && root.source?.revision === owner.revision
        && root.selection?.storyId === owner.target.storyId && root.selection?.variantId === owner.target.variantId
        && getHistoireSessionDescriptor(source).inspection?.pick?.available === true && session.getSnapshot().inspection?.pick?.available === true
    }
    catch { return false }
  }
  /** Resolve a selected-frame pointer in its document's CSS pixels. */
  async function pick(event: CanvasToolPointerEvent, context: CanvasScopedContext) {
    cancel()
    const session = current.value
    const captured = captureInspectionFrame(session, selected())
    if (!captured || !allowed(session, captured.owner) || !event.frame || event.frame.key !== captured.frame.context.frame.key || event.frame.target.storyId !== captured.owner.target.storyId || event.frame.target.variantId !== captured.owner.target.variantId) return
    const point = context.canvas.viewportToFrame?.(event.frame.key, event.viewport)
    const geometry = context.canvas.frames().find(item => item.frame.key === event.frame!.key)
    if (!point || !geometry || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 || point.x > geometry.rect.width || point.y > geometry.rect.height) return
    const request = generation
    const controller = new AbortController()
    pending = controller
    const abort = () => controller.abort()
    captured.frame.signal.addEventListener('abort', abort, { once: true })
    api.signal.addEventListener('abort', abort, { once: true })
    try {
      const result = await session.inspect.pick({ ...point, target: captured.owner.target, expectedOwner: captured.owner, signal: controller.signal })
      const next = captureInspectionFrame(session, selected())
      if (request !== generation || controller.signal.aborted || current.value !== session || next?.frame !== captured.frame || !sameInspectionOwner(next.owner, captured.owner) || !sameInspectionOwner(result.owner, captured.owner) || !allowed(session, captured.owner)) return
      publish({ owner: captured.owner, frameKey: event.frame.key, ...(result.matched && result.selector ? { selector: result.selector } : { message: 'No element at this point' }) })
      api.context.navigation.openInspectorTab('histoire-inspection:state')
    }
    catch (error) {
      if (request === generation && !controller.signal.aborted && current.value === session && allowed(session, captured.owner)) {
        const message = error instanceof HistoireSdkError ? error.message.replace(/preview/gi, 'variant') : error instanceof Error ? error.message : 'Could not pick element'
        publish({ owner: captured.owner, frameKey: event.frame.key, failed: true, message })
        api.context.navigation.openInspectorTab('histoire-inspection:state')
      }
    }
    finally {
      captured.frame.signal.removeEventListener('abort', abort)
      api.signal.removeEventListener('abort', abort)
      if (request === generation) pending = undefined
    }
  }
  return { pick, cancel }
}
