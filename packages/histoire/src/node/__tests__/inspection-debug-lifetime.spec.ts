import { Console } from 'node:console'
import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { createDebugBuffer } from '../../../../histoire-protocol/src/inspection/debug-buffer.js'
import { observeRuntimeDiagnostics } from '../../../../histoire-shared/src/inspection/diagnostics.js'
import { createRuntimeDebug } from '../virtual/preview-runtime/debug-service.js'

const bridge = { sessionId: 'session', connectionId: 'connection', mountId: 'mount' }
const owner = { sourceId: 'source', epoch: 'epoch', revision: 'rev', runtimeId: 'document', target: { storyId: 'story', variantId: 'variant' } }
const bridgeOwner = { ...owner, ...bridge }

/** Create a real EventTarget and console sink without modifying the test runner console. */
function documentTarget() {
  let output = ''
  const target = new EventTarget() as EventTarget & { console: Console }
  target.console = new Console(new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString()
      callback()
    },
  }))
  return { target, output: () => output }
}

describe('runtime diagnostics', () => {
  it('shares instrumentation, preserves previous and replacement console handlers, and isolates observer lifetimes', () => {
    const { target, output } = documentTarget()
    const original = target.console.log
    const service = createRuntimeDebug(target as any, createDebugBuffer, observeRuntimeDiagnostics)
    const first = { observationId: 'first', expectedOwner: owner }
    const second = { observationId: 'second', expectedOwner: owner }
    service.run({ ...first, action: 'start' }, bridgeOwner)
    target.console.log('first bearer abc123')
    service.run({ ...second, action: 'start' }, bridgeOwner)
    target.console.log('second token=secret https://user:pass@example.com/path?secret=value')
    const page = service.run({ ...second, action: 'read', afterSequence: 0 }, bridgeOwner)
    expect(page.items.map(item => item.message)).toEqual(['second token=[redacted] https://example.com/path'])
    expect(page.items[0].owner).toEqual(owner)
    expect(service.run({ ...first, action: 'stop' }, bridgeOwner).items).toHaveLength(2)
    target.console.log('still active')
    expect(service.run({ ...second, action: 'read', afterSequence: page.nextSequence }, bridgeOwner).items.map(item => item.message)).toEqual(['still active'])
    expect(output()).toContain('first bearer abc123')
    const replacement = () => {}
    target.console.log = replacement
    service.run({ ...second, action: 'stop' }, bridgeOwner)
    expect(target.console.log).toBe(replacement)
    target.console.log = original
    service.run({ ...first, action: 'start' }, bridgeOwner)
    service.close()
    expect(target.console.log).toBe(original)
    expect(() => service.run({ ...first, action: 'read' }, bridgeOwner)).toThrow('Diagnostic observation is closed')
  })

  it('records error events without invoking object getters and does not expose arguments after cleanup', () => {
    const { target } = documentTarget()
    const service = createRuntimeDebug(target as any, createDebugBuffer, observeRuntimeDiagnostics)
    const input = { observationId: 'first', expectedOwner: owner }
    service.run({ ...input, action: 'start' }, bridgeOwner)
    const payload = Object.defineProperty({}, 'toString', {
      get() {
        throw new Error('must not run')
      },
    })
    target.console.log(payload)
    const error = new Event('error')
    Object.defineProperty(error, 'message', { value: 'failed password=hunter2' })
    target.dispatchEvent(error)
    expect(service.run({ ...input, action: 'read' }, bridgeOwner).items.map(item => item.message)).toEqual(['[object]', 'failed password=[redacted]'])
    service.run({ ...input, action: 'stop' }, bridgeOwner)
    target.dispatchEvent(error)
    service.run({ ...input, action: 'start' }, bridgeOwner)
    expect(service.run({ ...input, action: 'read' }, bridgeOwner).items).toEqual([])
    service.close()
    expect(() => service.run({ ...input, action: 'start' }, bridgeOwner)).toThrow('Diagnostic observation is closed')
  })

  it('keeps a reentrant successor active until its own stop', () => {
    const { target } = documentTarget()
    let debug = target.console.debug
    const original = debug
    let restart = false
    let service: ReturnType<typeof createRuntimeDebug>
    const next = { observationId: 'next', expectedOwner: owner }
    Object.defineProperty(target.console, 'debug', {
      configurable: true,
      get: () => debug,
      set(value) {
        debug = value
        if (restart && value === original) {
          restart = false
          service.run({ ...next, action: 'start' }, bridgeOwner)
        }
      },
    })
    service = createRuntimeDebug(target as any, createDebugBuffer, observeRuntimeDiagnostics)
    const previous = { observationId: 'previous', expectedOwner: owner }
    service.run({ ...previous, action: 'start' }, bridgeOwner)
    restart = true
    service.run({ ...previous, action: 'stop' }, bridgeOwner)
    target.console.log('successor')
    expect(service.run({ ...next, action: 'read' }, bridgeOwner).items.map(item => item.message)).toEqual(['successor'])
    service.run({ ...next, action: 'stop' }, bridgeOwner)
    expect(target.console.debug).toBe(original)
  })

  it('rejects another owner and reports rate loss without growing history', () => {
    const { target } = documentTarget()
    const service = createRuntimeDebug(target as any, createDebugBuffer, observeRuntimeDiagnostics)
    const input = { observationId: 'first', expectedOwner: owner }
    service.run({ ...input, action: 'start' }, bridgeOwner)
    expect(() => service.run({ ...input, action: 'stop' }, { ...bridgeOwner, connectionId: 'peer' })).toThrow('Diagnostic observation is closed')
    expect(() => service.run({ ...input, action: 'read' }, { ...bridgeOwner, selectionVersion: 2 })).toThrow('Diagnostic observation is closed')
    const other = { ...owner, target: { ...owner.target, variantId: 'other' } }
    expect(() => service.run({ ...input, expectedOwner: other, action: 'stop' }, bridgeOwner)).toThrow('Diagnostic observation is closed')
    for (let index = 0; index < 55; index++) target.console.log('event')
    const page = service.run({ ...input, action: 'read' }, bridgeOwner)
    expect(page.items).toHaveLength(50)
    expect(page.droppedCount).toBe(5)
    const tail = service.run({ ...input, action: 'read', afterSequence: page.nextSequence }, bridgeOwner)
    expect(tail).toMatchObject({ items: [], nextSequence: 55, droppedCount: 5, gap: true })
    service.close()
  })
})
