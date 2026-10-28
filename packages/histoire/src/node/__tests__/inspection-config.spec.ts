import { expect, it } from 'vitest'
import { resolveInspectionConfig } from '../config/inspection.js'
import { createEmbedDescriptor } from '../virtual/embed/descriptor.js'
import { createEmbedSourceFixture } from './utils/embed/source.js'

it('requires explicit opt-in and exact inspection origins', () => {
  expect(resolveInspectionConfig()).toEqual({ enabled: false, diagnostics: false, components: false, accessibility: false, allowedOrigins: [] })
  expect(resolveInspectionConfig({ enabled: true, allowedOrigins: ['https://host.test'] })).toEqual({ enabled: true, diagnostics: false, components: false, accessibility: false, allowedOrigins: ['https://host.test'] })
  for (const input of [{ enabled: 'yes' }, { enabled: true, arbitraryCode: true }, { enabled: true, allowedOrigins: ['*'] }, { enabled: true, allowedOrigins: ['https://host.test/path'] }]) {
    expect(() => resolveInspectionConfig(input as never)).toThrow()
  }
})

it('advertises supported reads only for opted-in books with executable variants', async () => {
  const fixture = await createEmbedSourceFixture()
  try {
    for (const mode of ['dev', 'static'] as const) {
      delete fixture.context.config.inspection
      expect(createEmbedDescriptor(fixture.context, fixture.catalog.current, mode, 'build').inspection).toBeUndefined()
      fixture.context.config.inspection = { enabled: true, allowedOrigins: ['https://host.test'] }
      const descriptor = createEmbedDescriptor(fixture.context, fixture.catalog.current, mode, 'build')
      expect(descriptor.inspection).toEqual({ variant: { available: true }, dom: { available: true }, highlight: { available: true }, pick: { available: true }, highlightLease: { available: true }, components: { available: false }, componentDetails: { available: false }, componentHighlight: { available: false }, accessibilityAudit: { available: false }, diagnostics: { available: false } })
      expect(descriptor.inspectionPolicy).toEqual({ allowedOrigins: ['https://host.test'] })
      fixture.context.config.inspection = { enabled: true, components: true, accessibility: true }
      const components = createEmbedDescriptor(fixture.context, fixture.catalog.current, mode, 'build')
      expect(components.inspection?.components?.available).toBe(true)
      expect(components.inspection?.componentDetails?.available).toBe(true)
      expect(components.inspection?.componentHighlight?.available).toBe(true)
      expect(components.inspection?.accessibilityAudit?.available).toBe(true)
      const snapshot = fixture.catalog.current
      const noRuntime = { ...snapshot, catalog: { ...snapshot.catalog, stories: [] } }
      expect(createEmbedDescriptor(fixture.context, noRuntime, mode, 'build').inspection).toEqual({ variant: { available: false }, dom: { available: false }, highlight: { available: false }, pick: { available: false }, highlightLease: { available: false }, components: { available: false }, componentDetails: { available: false }, componentHighlight: { available: false }, accessibilityAudit: { available: false }, diagnostics: { available: false } })
    }
  }
  finally { await fixture.close() }
})
