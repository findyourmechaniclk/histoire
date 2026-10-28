import { describe, expect, it } from 'vitest'
import { getProjectServices } from '../../api/internal.js'
import { createHistoireProject } from '../../api/project.js'

describe('node inspection input admission', () => {
  it('rejects invalid input before starting work and leaves the project usable', async () => {
    const project = await createHistoireProject({ root: process.cwd() })
    const target = { source: 'dev' as const, storyId: 'story', variantId: 'variant' }
    try {
      await expect(project.inspect.dom({ ...target, signal: {} as AbortSignal })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
      await expect(project.inspect.dom({ ...target, selector: '' })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
      await expect(project.inspect.dom({ ...target, maxNodes: 501 })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
      await expect(project.inspect.dom({ ...target, unknown: true } as any)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
      expect(getProjectServices(project).execution.pendingCount).toBe(0)
      await expect(project.inspect.variant(target)).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
      await expect(project.inspect.dom({ ...target, selector: undefined, width: undefined })).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
    }
    finally { await project.close() }
  })
})
