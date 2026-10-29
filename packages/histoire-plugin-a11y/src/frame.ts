import type { FramePluginContext } from '@histoire/plugin-kit/frame'
import type { AuditUpdate } from './messages.js'
import type { AuditElements } from './scanner/run.js'
import { defineFramePlugin } from '@histoire/plugin-kit/frame'
import { createHighlighter } from './frame/highlight.js'
import { command, send } from './messages.js'
import { normalizeOptions } from './options.js'
import { runAudit } from './scanner/run.js'

/** Own observation and serialized scans for exactly one rendered actor. */
function attach(frame: FramePluginContext): void {
  const options = normalizeOptions(frame.options as Parameters<typeof normalizeOptions>[0])
  const highlight = createHighlighter(frame.element, frame.signal)
  let visit: string | undefined
  let autoRun = false
  let request = 0
  let reportId = 0
  let elements: AuditElements = new Map()
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let busy = false
  let pending = false
  let staleNotified = true
  let stopState: (() => void) | undefined

  /** Send only while current inspector visit owns actor. */
  function update(data: Omit<AuditUpdate, 'visit' | 'request'>): void {
    if (visit && !frame.signal.aborted) void send(frame.channel, 'update', { visit, request, ...data }).catch(() => {})
  }

  /** Run at most one scan, retaining admission after cancellation until raw axe settles. */
  async function run(): Promise<void> {
    if (!visit || frame.signal.aborted) return
    if (busy) {
      pending = true
      return
    }
    clearTimeout(timer)
    pending = false
    busy = true
    const owner = visit
    const sequence = ++request
    controller = new AbortController()
    const signal = controller.signal
    highlight.clear()
    staleNotified = true
    update({ running: true, stale: true })
    try {
      const result = await runAudit(frame.element, options, signal)
      if (visit !== owner || signal.aborted || frame.signal.aborted || sequence !== request) return
      elements = pending ? new Map() : result.elements
      staleNotified = pending
      reportId = sequence
      update({ running: false, stale: pending, reportId, report: result.report })
    }
    catch (error) {
      if (visit === owner && !signal.aborted && !frame.signal.aborted) update({ running: false, stale: true, error: error instanceof Error ? error.message : String(error) })
    }
    finally {
      busy = false
      if (pending && visit) schedule()
    }
  }

  /** Coalesce state/DOM changes and invalidate element handles immediately. */
  function schedule(): void {
    if (!visit) return
    elements.clear()
    highlight.clear()
    if (!staleNotified) update({ stale: true })
    staleNotified = true
    if (!autoRun) return
    if (busy) pending = true
    clearTimeout(timer)
    timer = setTimeout(() => void run(), 300)
  }
  const observer = new MutationObserver(schedule)

  /** Stop automatic work; leave non-abortable engine owned by shared admission. */
  function deactivate(): void {
    visit = undefined
    autoRun = false
    pending = false
    clearTimeout(timer)
    controller?.abort()
    observer.disconnect()
    stopState?.()
    stopState = undefined
    elements.clear()
    highlight.clear()
  }

  /** Enable observation only while active tab requests live auditing. */
  function observe(): void {
    observer.disconnect()
    stopState?.()
    stopState = undefined
    if (visit) {
      observer.observe(frame.element, { subtree: true, childList: true, attributes: true, characterData: true })
      stopState = frame.state.subscribe(schedule)
    }
  }

  frame.onCleanup(frame.channel.on('activate', (value) => {
    const data = command(value)
    if (!data) return
    deactivate()
    visit = data.visit
    autoRun = data.autoRun === true
    observe()
    if (autoRun) void run()
  }))
  frame.onCleanup(frame.channel.on('stop', (value) => {
    if (command(value)?.visit === visit) deactivate()
  }))
  frame.onCleanup(frame.channel.on('run', (value) => {
    if (command(value)?.visit === visit) void run()
  }))
  frame.onCleanup(frame.channel.on('configure', (value) => {
    const data = command(value)
    if (!data || data.visit !== visit) return
    autoRun = data.autoRun === true
    observe()
    if (autoRun) {
      void run()
    }
    else {
      clearTimeout(timer)
      pending = false
    }
  }))
  frame.onCleanup(frame.channel.on('highlight', (value) => {
    const data = command(value)
    if (!data || data.visit !== visit) return
    const found = data.reportId === reportId && typeof data.node === 'string' && highlight.show(elements.get(data.node))
    update({ feedback: found ? 'Element highlighted' : 'Element changed; run checks again' })
  }))
  frame.onCleanup(deactivate)
}

export default defineFramePlugin({ id: 'a11y', apiVersion: 1, attach })
