import type { HistoireInspectionOwner } from '@histoire/protocol'
import type { HistoireSession } from '@histoire/sdk'
import type { FrameContextHandle } from '../../../extensions/frame-context.js'

/** Capture an active exact frame; cached inspector contexts never grant authority. */
export function captureInspectionFrame(session: HistoireSession, frame: FrameContextHandle | null | undefined) {
  const snapshot = session.getSnapshot()
  const source = snapshot.source
  const target = snapshot.selection
  if (!frame || frame.signal.aborted || frame.context.runtime.getSnapshot() !== snapshot || snapshot.status !== 'ready' || snapshot.stale || snapshot.runtime.status !== 'ready' || !snapshot.runtime.runtimeId || !source || !target?.variantId || frame.context.frame.target.storyId !== target.storyId || frame.context.frame.target.variantId !== target.variantId) return
  const owner: HistoireInspectionOwner = { sourceId: source.sourceId, epoch: source.epoch, revision: source.revision, runtimeId: snapshot.runtime.runtimeId, target: { storyId: target.storyId, variantId: target.variantId } }
  return { frame, owner }
}
