// Frame entry: evaluated only in interactive story frames, once per rendered actor.
import type { FramePluginContext } from '@histoire/plugin-kit/frame'
import type { HighlightMessage } from '../domain/messages.js'
import { defineFramePlugin } from '@histoire/plugin-kit/frame'
import { auditElement } from '../domain/audit.js'
import { REFERENCE_MESSAGES } from '../domain/messages.js'
import { normalizeReferenceOptions, REFERENCE_PLUGIN_ID } from '../options.js'
import { highlightElement } from './highlight.js'

/**
 * Audits the rendered variant now and whenever its DOM or state changes, and answers
 * workbench requests on this actor's channel.
 * @param frame Context of one rendered actor.
 */
function attach(frame: FramePluginContext): void {
  const options = normalizeReferenceOptions(frame.options)
  let elements: Element[] = []
  let last = ''

  /**
   * Audits and posts the report.
   * @param force Post even when the report did not change (explicit workbench request).
   */
  const run = (force: boolean) => {
    if (frame.signal.aborted) return
    const result = auditElement(frame.element, options)
    elements = result.elements
    const serialized = JSON.stringify(result.report)
    if (!force && serialized === last) return
    last = serialized
    // Posts are dropped (and counted) when the workbench side is not listening or over limits.
    frame.channel.post(REFERENCE_MESSAGES.report, result.report).catch(() => {})
  }

  // Coalesce DOM and state bursts into one audit per animation frame.
  let scheduled = 0
  const schedule = () => {
    if (!scheduled) {
      scheduled = requestAnimationFrame(() => {
        scheduled = 0
        run(false)
      })
    }
  }
  const observer = new MutationObserver(schedule)
  observer.observe(frame.element, { subtree: true, childList: true, attributes: true, characterData: true })
  frame.onCleanup(() => {
    observer.disconnect()
    cancelAnimationFrame(scheduled)
  })
  frame.onCleanup(frame.state.subscribe(schedule))
  frame.onCleanup(frame.channel.on(REFERENCE_MESSAGES.audit, () => run(true)))
  frame.onCleanup(frame.channel.on(REFERENCE_MESSAGES.highlight, (data) => {
    const element = elements[(data as HighlightMessage | null)?.index ?? -1]
    if (element) highlightElement(element, frame.signal)
  }))
  run(true)
}

export default defineFramePlugin({ id: REFERENCE_PLUGIN_ID, apiVersion: 1, attach })
