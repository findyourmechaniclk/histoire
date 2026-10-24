import { describe, expect, it } from 'vitest'
import { validateHistoireSourceDescriptor } from '../bridge/catalog.js'
import { validateBridgeEnvelope } from '../bridge/envelope.js'
import { validateBridgeEventPayload } from '../bridge/events.js'
import { validateBridgePayload } from '../bridge/payload.js'
import { createPluginChannelLimiters, validatePluginChannelPayload } from '../plugin-channels.js'
import { createProtocolDescriptor } from './fixtures/catalog.js'

const message = { pluginId: 'probe', actorId: 'actor-1', type: 'ping', data: { value: 1 } }
const owner = { protocolVersion: 1, sessionId: 's', connectionId: 'c', mountId: 'm', sourceId: 'src', epoch: 'e', revision: 'r' }

describe('plugin channel payloads', () => {
  it('admits bounded JSON addressed to one plugin actor and nothing else', () => {
    expect(validatePluginChannelPayload(message)).toEqual(message)
    for (const patch of [{ pluginId: 'Probe' }, { pluginId: 'builtin' }, { actorId: '' }, { type: '' }, { data: undefined }, { data: () => {} }, { name: 'factory' }]) {
      expect(() => validatePluginChannelPayload({ ...message, ...patch })).toThrowError(expect.objectContaining({ code: 'INVALID_ARGUMENT' }))
    }
    expect(() => validatePluginChannelPayload({ ...message, data: 'x'.repeat(65536) })).toThrowError(expect.objectContaining({ code: 'RESULT_TOO_LARGE' }))
  })

  it('reserves lifecycle notices for the frame runtime', () => {
    expect(() => validatePluginChannelPayload({ ...message, type: 'histoire:attached', data: null })).toThrow('reserved')
    const attributed = { ...message, target: { storyId: 's', variantId: 'v' }, runtimeId: 'doc' }
    expect(() => validatePluginChannelPayload({ ...attributed, type: 'histoire:attached', data: null }, true)).not.toThrow()
    expect(() => validatePluginChannelPayload({ ...attributed, type: 'histoire:error', data: { phase: 'attach', message: 'boom' } }, true)).not.toThrow()
    expect(() => validatePluginChannelPayload({ ...attributed, type: 'histoire:attached', data: { forged: true } }, true)).toThrow()
    expect(() => validatePluginChannelPayload({ ...attributed, type: 'histoire:other', data: null }, true)).toThrow()
    expect(() => validatePluginChannelPayload({ ...attributed, target: { storyId: 's', variantId: null } }, true)).toThrow()
  })

  it('keeps plugin traffic and named host channels apart on the bridge', () => {
    expect(() => validateBridgePayload('plugin.post', message)).not.toThrow()
    expect(() => validateBridgePayload('channel.post', { ...message, name: 'factory' })).toThrow()
    expect(() => validateBridgeEventPayload('channel.message', { ...message, target: { storyId: 's', variantId: 'v' }, runtimeId: 'doc' })).toThrow()
    const request = { ...owner, kind: 'request', requestId: '1', command: 'plugin.post', payload: message }
    expect(() => validateBridgeEnvelope(request, owner, 'data')).toThrow('Data port cannot execute runtime commands')
    expect(() => validateBridgeEnvelope(request, owner, 'primary')).not.toThrow()
  })

  it('accepts plugin publications only from the exact primary document and story', () => {
    const payload = { ...message, target: { storyId: 's', variantId: 'v' }, runtimeId: 'doc' }
    const event = { ...owner, runtimeId: 'doc', target: { storyId: 's', variantId: 'other' }, kind: 'event', event: 'plugin.message', sequence: 1, payload }
    expect(() => validateBridgeEnvelope(event, owner, 'primary', undefined, 'child-to-parent')).not.toThrow()
    expect(() => validateBridgeEnvelope({ ...event, runtimeId: 'forged' }, owner, 'primary', undefined, 'child-to-parent')).toThrow()
    expect(() => validateBridgeEnvelope({ ...event, target: { storyId: 'other', variantId: 'v' } }, owner, 'primary', undefined, 'child-to-parent')).toThrow()
    expect(() => validateBridgeEnvelope(event, owner, 'controls', undefined, 'child-to-parent')).toThrow()
  })
})

describe('per-plugin accounting', () => {
  it('saturates one plugin without charging another', () => {
    let now = 0
    const limiters = createPluginChannelLimiters(() => now)
    for (let index = 0; index < 55; index++) limiters.get('noisy').outgoing.accept()
    limiters.get('noisy').incoming.drop()
    expect(limiters.droppedCount('noisy')).toBe(6)
    expect(limiters.get('quiet').outgoing.accept()).toBe(true)
    expect(limiters.droppedCount('quiet')).toBe(0)
    now = 1000
    expect(limiters.get('noisy').outgoing.accept()).toBe(true)
    limiters.reset()
    expect(limiters.droppedCount('noisy')).toBe(0)
  })
})

describe('frame plugin inventory in source descriptors', () => {
  it('advertises installed frame plugins as data and rejects malformed entries', () => {
    const descriptor = createProtocolDescriptor()
    const advertised = { ...descriptor, framePlugins: [{ id: 'probe', apiVersion: 1 }], capabilities: { ...descriptor.capabilities, framePlugins: { available: true } } }
    expect(() => validateHistoireSourceDescriptor(advertised)).not.toThrow()
    // Books without frame plugins keep the legacy shape.
    expect(() => validateHistoireSourceDescriptor(descriptor)).not.toThrow()
    for (const framePlugins of [[{ id: 'Probe', apiVersion: 1 }], [{ id: 'probe', apiVersion: 1, client: '/abs/path.js' }], [{ id: 'probe', apiVersion: 1 }, { id: 'probe', apiVersion: 1 }], [{ id: 'probe', apiVersion: 1.5 }], {}]) {
      expect(() => validateHistoireSourceDescriptor({ ...advertised, framePlugins })).toThrow()
    }
  })
})
