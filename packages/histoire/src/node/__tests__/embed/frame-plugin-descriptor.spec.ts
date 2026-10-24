import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmbedDescriptor } from '../../virtual/embed/descriptor.js'
import { createEmbedSourceFixture } from '../utils/embed/source.js'

// Descriptor tests use the exact source implementation when bundled app dist is not built.
vi.mock('@histoire/app/dist/embed/capabilities.js', async () => import('../../../../../histoire-app/src/embed/capabilities.js'))

describe('frame plugin inventory in descriptors', () => {
  let fixture: Awaited<ReturnType<typeof createEmbedSourceFixture>>
  beforeEach(async () => {
    fixture = await createEmbedSourceFixture()
  })
  afterEach(async () => {
    await fixture.close()
  })

  it('advertises frame entries as data only and omits dev-only ones from static books', async () => {
    fixture.context.workbenchPlugins = [
      { id: 'probe', apiVersion: 1, options: { secret: 'never-sent' }, devOnly: false, frame: '/abs/plugins/probe.js' },
      { id: 'panel', apiVersion: 1, options: undefined, devOnly: false, client: '/abs/plugins/panel.js' },
      { id: 'debug', apiVersion: 1, options: undefined, devOnly: true, frame: '/abs/plugins/debug.js' },
    ]
    const snapshot = fixture.catalog.current
    const dev = createEmbedDescriptor(fixture.context, snapshot, 'dev')
    expect(dev.framePlugins).toEqual([{ id: 'probe', apiVersion: 1 }, { id: 'debug', apiVersion: 1 }])
    expect(dev.capabilities.framePlugins).toEqual({ available: true })
    expect(JSON.stringify(dev)).not.toContain('/abs/plugins')
    expect(JSON.stringify(dev)).not.toContain('never-sent')
    expect(createEmbedDescriptor(fixture.context, snapshot, 'static', 'build').framePlugins).toEqual([{ id: 'probe', apiVersion: 1 }])
  })

  it('keeps the legacy descriptor shape for books without frame plugins', async () => {
    const descriptor = createEmbedDescriptor(fixture.context, fixture.catalog.current, 'dev')
    expect(descriptor).not.toHaveProperty('framePlugins')
    expect(descriptor.capabilities).not.toHaveProperty('framePlugins')
  })
})
