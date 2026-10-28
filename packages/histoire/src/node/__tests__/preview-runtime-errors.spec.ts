// @vitest-environment jsdom
import { runInNewContext } from 'node:vm'
import { serializeTestError } from '@histoire/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { previewErrorOverlay } from '../virtual/preview-runtime/error-overlay.js'

/** Execute emitted reporter against genuine DOM and captured window event ports. */
function errorReporter() {
  const listeners = new Map<string, (event: { error?: unknown, message?: string, reason?: unknown }) => void>()
  const order: string[] = []
  const postToParent = vi.fn(() => {
    order.push('failure')
  })
  document.body.innerHTML = '<div id="app">Mounted variant</div>'
  runInNewContext(previewErrorOverlay(), {
    window: { Event: window.Event, addEventListener: (type, listener) => listeners.set(type, listener), dispatchEvent: event => order.push(event.type) },
    document,
    Error,
    serializeTestError,
    postToParent,
    RUNTIME_FAILED: 'failed',
  })
  return { listeners, postToParent, order }
}

afterEach(() => document.body.replaceChildren())

describe('runtime error reporting during native document resize', () => {
  it.each(['ResizeObserver loop completed with undelivered notifications.', 'ResizeObserver loop limit exceeded'])('keeps runtime ready for browser notification: %s', (message) => {
    const reporter = errorReporter()
    reporter.listeners.get('error')!({ message, error: null })
    expect(reporter.postToParent).not.toHaveBeenCalled()
    expect(reporter.order).toEqual([])
    expect(document.body.textContent).toBe('Mounted variant')
  })

  it('reports genuine exceptions with matching text and unhandled rejections', () => {
    const reporter = errorReporter()
    const message = 'ResizeObserver loop completed with undelivered notifications.'
    reporter.listeners.get('error')!({ message, error: new Error(message) })
    reporter.listeners.get('unhandledrejection')!({ reason: new Error('Story crashed') })
    expect(reporter.postToParent.mock.calls.map(([value]) => value.error.message)).toEqual([message, 'Story crashed'])
    expect(reporter.order).toEqual(['histoire:runtime-failed', 'failure', 'histoire:runtime-failed', 'failure'])
    expect(document.querySelector('#app')?.textContent).toBe('Mounted variant')
  })
})
