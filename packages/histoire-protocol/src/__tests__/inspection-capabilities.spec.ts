import { describe, expect, it } from 'vitest'
import { hasInspectionCapability, validateBridgeEnvelope, validateBridgeEventPayload, validateHistoireAck, validateHistoireSnapshot, validateHistoireSourceDescriptor } from '../index.js'
import { createProtocolDescriptor, createProtocolSnapshot } from './fixtures/catalog.js'
import * as old from './fixtures/generated/reader-v1.mjs'

const inspection = { variant: { available: true }, dom: { available: false, reason: 'CAPABILITY_UNAVAILABLE' } }

describe('additive inspection protocol compatibility', () => {
  it('accepts old descriptors and denies absent or false features', () => {
    const descriptor = createProtocolDescriptor()
    expect(validateHistoireSourceDescriptor(descriptor)).toBe(descriptor)
    expect(hasInspectionCapability(descriptor.inspection, 'variant')).toBe(false)
    expect(hasInspectionCapability(inspection, 'dom')).toBe(false)
    expect(hasInspectionCapability(inspection, 'variant')).toBe(true)
  })

  it('passes new descriptors through frozen old discovery, handshake and update readers', () => {
    const descriptor = { ...createProtocolDescriptor(), inspection, inspectionPolicy: { allowedOrigins: ['https://host.test'] } }
    const hello = { kind: 'histoire:hello', protocolRange: { min: 1, max: 1 }, nonce: 'challenge', sessionId: 'session', mountId: 'mount', parentOrigin: 'https://host.test', role: 'data' } as const
    const owner = { protocolVersion: 1, sessionId: 'session', connectionId: 'connection', mountId: 'mount', sourceId: descriptor.sourceId, epoch: descriptor.epoch, revision: descriptor.revision }
    const ack = { kind: 'histoire:ack', nonce: hello.nonce, protocolRange: hello.protocolRange, ok: true, owner, descriptor }
    for (const reader of [old, { validateHistoireSourceDescriptor, validateHistoireAck, validateBridgeEnvelope }]) {
      expect(reader.validateHistoireSourceDescriptor(descriptor)).toBe(descriptor)
      expect(reader.validateHistoireAck(ack, hello)).toBe(ack)
      const update = { ...owner, kind: 'event', event: 'catalog.changed', sequence: 1, payload: { descriptor } }
      expect(reader.validateBridgeEnvelope(update, owner, 'data')).toBe(update)
    }
  })

  it('accepts additive view snapshots with both readers while keeping strict legacy nested keys', () => {
    const snapshot = { ...createProtocolSnapshot(), inspection }
    for (const validate of [old.validateHistoireSnapshot, validateHistoireSnapshot]) expect(validate(snapshot)).toBe(snapshot)
    const descriptor = createProtocolDescriptor()
    for (const validate of [old.validateHistoireSourceDescriptor, validateHistoireSourceDescriptor]) {
      expect(() => validate({ ...descriptor, capabilities: { ...descriptor.capabilities, inspection } })).toThrow('Unknown capability')
      expect(() => validate({ ...descriptor, embed: { allowedOrigins: [], allowOpenInEditor: false, allowServerTests: false, allowInspection: true } })).toThrow()
    }
  })

  it('rejects malformed extension capabilities and origins in new readers', () => {
    for (const malformed of [{ eval: { available: true } }, { dom: { available: true, principal: 'admin' } }, { dom: { available: 'yes' } }]) {
      expect(() => validateHistoireSourceDescriptor({ ...createProtocolDescriptor(), inspection: malformed })).toThrow()
      expect(() => validateHistoireSnapshot({ ...createProtocolSnapshot(), inspection: malformed })).toThrow()
    }
    for (const allowedOrigins of [['*'], ['null'], ['https://host.test/path']]) expect(() => validateHistoireSourceDescriptor({ ...createProtocolDescriptor(), inspectionPolicy: { allowedOrigins } })).toThrow()
  })

  it('bounds tolerated extensions and never invokes accessors', () => {
    const descriptor = createProtocolDescriptor()
    for (const validate of [old.validateHistoireSourceDescriptor, validateHistoireSourceDescriptor]) {
      expect(() => validate({ ...descriptor, future: { value: 'small' } })).not.toThrow()
      expect(() => validate({ ...descriptor, future: 'x'.repeat(8 * 1024 * 1024) })).toThrow()
    }
    let calls = 0
    const inspection = Object.defineProperty({}, 'dom', { enumerable: true, get() {
      calls++
      return { available: true }
    } })
    expect(() => validateHistoireSourceDescriptor({ ...descriptor, inspection })).toThrow()
    expect(calls).toBe(0)
  })

  it('validates actor capability publications while older readers accept the extension', () => {
    const snapshot = createProtocolSnapshot()
    const runtime = { ...snapshot.runtime, inspection: { components: { available: true }, componentDetails: { available: false } } }
    for (const reader of [old, { validateHistoireSnapshot, validateBridgeEventPayload }]) {
      expect(() => reader.validateHistoireSnapshot({ ...snapshot, runtime })).not.toThrow()
      expect(() => reader.validateBridgeEventPayload('readiness.changed', { runtime })).not.toThrow()
    }
    for (const malformed of [{ eval: { available: true } }, { components: { available: 'yes' } }, { components: { available: true, actor: 'other' } }, { components: { available: false, reason: 'x'.repeat(5000) } }]) {
      expect(() => validateBridgeEventPayload('readiness.changed', { runtime: { ...runtime, inspection: malformed } })).toThrow()
      expect(() => validateHistoireSnapshot({ ...snapshot, runtime: { ...runtime, inspection: malformed } })).toThrow()
    }
  })
})
