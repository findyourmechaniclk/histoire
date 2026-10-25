import type { Context } from '../context.js'
import { describe, expect, it, vi } from 'vitest'
import { analyzeCollectionModule } from '../test/eligibility/analysis.js'
import { collectionEligibilityTransformPlugin, transformCollectionEligibility } from '../test/eligibility/transforms.js'

vi.mock('../test/eligibility/analysis.js', async importOriginal => ({ ...await importOriginal<typeof import('../test/eligibility/analysis.js')>(), analyzeCollectionModule: vi.fn((await importOriginal<typeof import('../test/eligibility/analysis.js')>()).analyzeCollectionModule) }))

/**
 * Every client transform is remembered for test eligibility proofs, but only
 * story graphs are ever inspected: parsing each module at transform time cost
 * ~2 s of the dev server's main thread at startup in a Nuxt app.
 */
describe('collectionEligibilityTransformPlugin', () => {
  it('analyzes a remembered transform only when a proof reads it', async () => {
    const ctx = { root: '/project' } as Context
    const plugin = collectionEligibilityTransformPlugin(ctx) as { transform: (code: string, id: string) => void }
    const code = `import './dep.js'\nexport default 1`
    vi.mocked(analyzeCollectionModule).mockClear()

    plugin.transform.call({}, code, '/project/a.js')
    expect(analyzeCollectionModule).not.toHaveBeenCalled()

    const transform = vi.fn(async () => {})
    const first = await transformCollectionEligibility(ctx, '/project/a.js', transform)
    const second = await transformCollectionEligibility(ctx, '/project/a.js', transform)

    // Served from the remembered output, without transforming again, parsed once.
    expect(transform).not.toHaveBeenCalled()
    expect(first).toEqual(vi.mocked(analyzeCollectionModule).getMockImplementation()!(code))
    expect(second).toBe(first)
    expect(analyzeCollectionModule).toHaveBeenCalledOnce()
  })
})
