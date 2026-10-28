import { expect, it } from 'vitest'
import { validateBridgeEnvelope } from '../index.js'

const owner = { protocolVersion: 1, sessionId: 'session', connectionId: 'port', mountId: 'mount', sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'doc', target: { storyId: 'story', variantId: 'selected' }, selectionVersion: 2 }
const target = { storyId: 'story', variantId: 'other' }
const request = { ...owner, target, kind: 'request', requestId: 'one', command: 'inspection.dom', payload: { target, selector: 'button' } }

it('allows only an exact inspection target through the owning runtime port', () => {
  expect(() => validateBridgeEnvelope(request, owner, 'primary')).not.toThrow()
  expect(() => validateBridgeEnvelope(request, owner, 'data')).toThrow()
  expect(() => validateBridgeEnvelope({ ...request, runtimeId: 'successor' }, owner, 'primary')).toThrow()
  expect(() => validateBridgeEnvelope({ ...request, selectionVersion: undefined }, owner, 'primary')).toThrow()
  expect(() => validateBridgeEnvelope(request, { ...owner, runtimeId: undefined }, 'primary')).toThrow()
  expect(() => validateBridgeEnvelope({ ...request, payload: { target: owner.target } }, owner, 'primary')).toThrow()
  expect(() => validateBridgeEnvelope({ ...request, payload: { target, javascript: 'bad' } }, owner, 'primary')).toThrow()
  expect(() => validateBridgeEnvelope({ ...request, command: 'state.get', payload: {} }, owner, 'primary')).toThrow()
})

it('rejects replies attributed to another mounted target', () => {
  const captured = { ...owner, target }
  const result = { inspection: 'dom', mode: 'live', owner: { sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'doc', target }, observedAt: '2026-01-01T00:00:00Z', durationMs: 0, truncated: false, matched: false, nodes: [] }
  const response = { ...captured, kind: 'response', requestId: 'one', ok: true, result }
  expect(() => validateBridgeEnvelope(response, captured, 'primary', 'inspection.dom', 'child-to-parent')).not.toThrow()
  expect(() => validateBridgeEnvelope({ ...response, result: { ...result, owner: { ...result.owner, target: owner.target } } }, captured, 'primary', 'inspection.dom', 'child-to-parent')).toThrow()
})

it('accepts bounded component reads while binding input and reply to the captured target', () => {
  const captured = { ...owner, target }
  const resultOwner = { sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'doc', target }
  const base = { mode: 'live', owner: resultOwner, observedAt: '2026-01-01T00:00:00Z', durationMs: 0, truncated: false, coverage: 'partial', limitations: ['teleport'] }
  const node = { id: 'component', parentId: null, name: 'Button', framework: 'vue' }
  const examples = [
    { command: 'inspection.components', payload: { target, maxNodes: 3 }, result: { ...base, inspection: 'components', nodes: [node], omittedCount: 0 } },
    { command: 'inspection.component', payload: { target, componentId: 'component' }, result: { ...base, inspection: 'component', node, props: {}, selectors: [], omittedValues: 0 } },
    { command: 'inspection.componentForElement', payload: { target, selector: 'button' }, result: { ...base, inspection: 'componentForElement', matched: true, node } },
  ]
  for (const example of examples) {
    const message = { ...captured, kind: 'request', requestId: 'read', command: example.command, payload: example.payload }
    expect(() => validateBridgeEnvelope(message, owner, 'primary')).not.toThrow()
    expect(() => validateBridgeEnvelope(message, owner, 'data')).toThrow()
    expect(() => validateBridgeEnvelope({ ...message, payload: { ...example.payload, target: owner.target } }, owner, 'primary')).toThrow()
    expect(() => validateBridgeEnvelope({ ...message, payload: { ...example.payload, extra: true } }, owner, 'primary')).toThrow()
    const response = { ...captured, kind: 'response', requestId: 'read', ok: true, result: example.result }
    expect(() => validateBridgeEnvelope(response, captured, 'primary', example.command as any, 'child-to-parent')).not.toThrow()
    expect(() => validateBridgeEnvelope({ ...response, result: { ...example.result, owner: { ...resultOwner, runtimeId: 'other-doc' } } }, captured, 'primary', example.command as any, 'child-to-parent')).toThrow()
    expect(() => validateBridgeEnvelope({ ...response, result: { ...example.result, inspection: 'dom' } }, captured, 'primary', example.command as any, 'child-to-parent')).toThrow()
  }
})

it('binds live accessibility audits to their captured story and validates findings', () => {
  const captured = { ...owner, target }
  const message = { ...captured, kind: 'request', requestId: 'audit', command: 'inspection.accessibility', payload: { target, selector: 'main' } }
  expect(() => validateBridgeEnvelope(message, owner, 'primary')).not.toThrow()
  expect(() => validateBridgeEnvelope(message, owner, 'view', undefined, 'child-to-parent')).not.toThrow()
  expect(() => validateBridgeEnvelope(message, owner, 'data')).toThrow()
  expect(() => validateBridgeEnvelope({ ...message, payload: { target, arbitraryCode: true } }, owner, 'primary')).toThrow()
  expect(() => validateBridgeEnvelope({ ...message, payload: { target: owner.target } }, owner, 'primary')).toThrow()
  const result = { mode: 'live', owner: { sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'doc', target }, observedAt: '2026-01-01T00:00:00Z', durationMs: 0, truncated: false, inspection: 'accessibility', matched: true, engine: 'axe-core', engineVersion: '4.14.0', violations: [], incomplete: [], passesCount: 1, inapplicableCount: 0, droppedCount: 0 }
  const response = { ...captured, kind: 'response', requestId: 'audit', ok: true, result }
  expect(() => validateBridgeEnvelope(response, captured, 'primary', 'inspection.accessibility' as any, 'child-to-parent')).not.toThrow()
  expect(() => validateBridgeEnvelope({ ...response, result: { ...result, owner: { ...result.owner, target: owner.target } } }, captured, 'primary', 'inspection.accessibility' as any, 'child-to-parent')).toThrow()
  expect(() => validateBridgeEnvelope({ ...response, result: { ...result, engine: 'other' } }, captured, 'primary', 'inspection.accessibility' as any, 'child-to-parent')).toThrow()
})

it('validates point picks and highlight leases without extending the legacy highlight reply', () => {
  const captured = { ...owner, target }
  const publicOwner = { sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'doc', target }
  const cases = [
    { command: 'inspection.pick', payload: { target, x: 24, y: 40 }, result: { owner: publicOwner, observedAt: '2026-01-01T00:00:00Z', matched: true, selector: 'button' } },
    { command: 'inspection.highlightLease', payload: { target, selector: 'button', durationMs: 300 }, result: { owner: publicOwner, observedAt: '2026-01-01T00:00:00Z', leaseId: 'lease' } },
    { command: 'inspection.highlightClear', payload: { target, expectedOwner: publicOwner, leaseId: 'lease' }, result: { owner: publicOwner, cleared: true } },
  ]
  for (const example of cases) {
    const request = { ...captured, kind: 'request', requestId: 'read', command: example.command, payload: example.payload }
    const response = { ...captured, kind: 'response', requestId: 'read', ok: true, result: example.result }
    expect(() => validateBridgeEnvelope(request, owner, 'primary')).not.toThrow()
    expect(() => validateBridgeEnvelope({ ...request, payload: { ...example.payload, target: owner.target } }, owner, 'primary')).toThrow()
    expect(() => validateBridgeEnvelope({ ...request, payload: { ...example.payload, extra: true } }, owner, 'primary')).toThrow()
    expect(() => validateBridgeEnvelope(response, captured, 'primary', example.command as any, 'child-to-parent')).not.toThrow()
    expect(() => validateBridgeEnvelope({ ...response, result: { ...example.result, owner: { ...publicOwner, runtimeId: 'successor' } } }, captured, 'primary', example.command as any, 'child-to-parent')).toThrow()
  }
  expect(() => validateBridgeEnvelope({ ...captured, kind: 'request', requestId: 'pick', command: 'inspection.pick', payload: { target, x: 1000001, y: 0 } }, owner, 'primary')).toThrow()
  expect(() => validateBridgeEnvelope({ ...captured, kind: 'request', requestId: 'clear', command: 'inspection.highlightClear', payload: { target, expectedOwner: publicOwner, leaseId: 'x'.repeat(129) } }, owner, 'primary')).toThrow()
  expect(() => validateBridgeEnvelope({ ...captured, kind: 'request', requestId: 'clear', command: 'inspection.highlightClear', payload: { target, leaseId: 'lease' } }, owner, 'primary')).toThrow()
  expect(() => validateBridgeEnvelope({ ...captured, kind: 'request', requestId: 'clear', command: 'inspection.highlightClear', payload: { target, expectedOwner: { ...publicOwner, runtimeId: 'other' }, leaseId: 'lease' } }, owner, 'primary')).toThrow()
  const noMatch = { ...captured, kind: 'response', requestId: 'pick', ok: true, result: { owner: publicOwner, observedAt: '2026-01-01T00:00:00Z', matched: false } }
  expect(() => validateBridgeEnvelope(noMatch, captured, 'primary', 'inspection.pick', 'child-to-parent')).not.toThrow()
  expect(() => validateBridgeEnvelope({ ...noMatch, result: { ...noMatch.result, selector: 'body' } }, captured, 'primary', 'inspection.pick', 'child-to-parent')).toThrow()
  const old = { ...captured, kind: 'response', requestId: 'highlight', ok: true, result: { owner: publicOwner, observedAt: '2026-01-01T00:00:00Z' } }
  expect(() => validateBridgeEnvelope(old, captured, 'primary', 'inspection.highlight', 'child-to-parent')).not.toThrow()
})
