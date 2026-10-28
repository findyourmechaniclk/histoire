import { expect, it } from 'vitest'
import { validateBridgeEnvelope } from '../index.js'

it('keeps diagnostic commands and replies bound to their captured runtime and target', () => {
  const target = { storyId: 'story', variantId: 'variant' }
  const identity = { protocolVersion: 1, sessionId: 'session', connectionId: 'port', mountId: 'mount', sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'doc', target, selectionVersion: 1 }
  const owner = { sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'doc', target }
  const request = { ...identity, kind: 'request', requestId: 'request', command: 'inspection.debug', payload: { action: 'start', observationId: 'observer', expectedOwner: owner, target } }
  const result = { inspection: 'debug', mode: 'live', owner, observedAt: '2026-01-01T00:00:00Z', durationMs: 0, truncated: false, items: [], nextSequence: 0, oldestSequence: 1, droppedCount: 0, gap: false }
  const response = { ...identity, kind: 'response', requestId: 'request', ok: true, result }
  expect(() => validateBridgeEnvelope(request, identity, 'primary')).not.toThrow()
  expect(() => validateBridgeEnvelope(request, identity, 'data')).toThrow()
  expect(() => validateBridgeEnvelope({ ...request, runtimeId: 'other' }, identity, 'primary')).toThrow()
  expect(() => validateBridgeEnvelope(response, identity, 'primary', 'inspection.debug', 'child-to-parent')).not.toThrow()
  expect(() => validateBridgeEnvelope({ ...response, result: { ...result, owner: { ...owner, runtimeId: 'other' } } }, identity, 'primary', 'inspection.debug', 'child-to-parent')).toThrow()
})
