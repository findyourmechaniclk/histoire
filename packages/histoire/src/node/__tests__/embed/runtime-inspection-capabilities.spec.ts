// @vitest-environment jsdom
import { VARIANT_READY } from '@histoire/protocol'
import { afterEach, expect, it, vi } from 'vitest'
import { createRuntimeFrameFixture, publishFrameMessage } from '../utils/embed/runtime-frame.js'

afterEach(() => vi.unstubAllGlobals())

it('accepts capability changes only from the current frame, document and actor', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const fixture = await createRuntimeFrameFixture({ inspection: { components: { available: true } } })
  const frame = fixture.container.querySelector('iframe')!
  try {
    publishFrameMessage(frame, VARIANT_READY, undefined, { inspectionCapabilities: {} })
    await fixture.primary.ready
    expect(fixture.session.getSnapshot().inspection?.components?.available).toBe(false)
    const data = { __histoire: true, type: 'histoire:inspection-capabilities', documentId: new URL(frame.src).searchParams.get('documentId'), storyId: 'a:b', variantId: 'c', inspectionCapabilities: { components: { available: true } } }
    window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, origin: 'https://foreign.test', data }))
    publishFrameMessage(frame, data.type, 'retired-document', { inspectionCapabilities: data.inspectionCapabilities })
    publishFrameMessage(frame, data.type, undefined, { variantId: 'other', inspectionCapabilities: data.inspectionCapabilities })
    expect(fixture.session.getSnapshot().inspection?.components?.available).toBe(false)
    publishFrameMessage(frame, data.type, undefined, { inspectionCapabilities: data.inspectionCapabilities })
    expect(fixture.session.getSnapshot().inspection?.components?.available).toBe(true)
    publishFrameMessage(frame, data.type, undefined, { inspectionCapabilities: {} })
    expect(fixture.session.getSnapshot().inspection?.components?.available).toBe(false)
  }
  finally { await fixture.close() }
})

it('revokes the affected runtime highlight when source permission changes', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const fixture = await createRuntimeFrameFixture({ inspection: { highlight: { available: true }, highlightLease: { available: true } } })
  const frame = fixture.container.querySelector('iframe')!
  try {
    publishFrameMessage(frame, VARIANT_READY, undefined, { inspectionCapabilities: { highlight: { available: true }, highlightLease: { available: true } } })
    await fixture.primary.ready
    const post = vi.spyOn(frame.contentWindow!, 'postMessage')
    fixture.source.descriptor.inspection!.highlightLease = { available: false }
    fixture.source.emitCatalog()
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ command: 'inspection.revoke', payload: { highlight: true, highlightLease: false, componentHighlight: false } }), window.location.origin)
  }
  finally { await fixture.close() }
})

it('revokes component highlights when component permission changes', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const fixture = await createRuntimeFrameFixture({ inspection: { highlight: { available: true }, componentHighlight: { available: true } } })
  const frame = fixture.container.querySelector('iframe')!
  try {
    publishFrameMessage(frame, VARIANT_READY, undefined, { inspectionCapabilities: { highlight: { available: true }, componentHighlight: { available: true } } })
    await fixture.primary.ready
    const post = vi.spyOn(frame.contentWindow!, 'postMessage')
    fixture.source.descriptor.inspection!.componentHighlight = { available: false }
    fixture.source.emitCatalog()
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ command: 'inspection.revoke', payload: { highlight: true, highlightLease: false, componentHighlight: false } }), window.location.origin)
  }
  finally { await fixture.close() }
})
