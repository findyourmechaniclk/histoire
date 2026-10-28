import { describe, expect, it } from 'vitest'
import { createExecutionService } from '../../runtime/execution-service.js'
import { createAccessibilityTask } from '../../runtime/inspection/accessibility-task.js'
import { createPreviewBrowserFixture } from '../utils/mcp/preview-browser.js'

const input = { storyId: 'story', variantId: 'variant' }

describe('isolated accessibility task lifecycle', () => {
  it('returns finite scanner errors and releases the execution lane', async () => {
    const browser = createPreviewBrowserFixture()
    browser.page.evaluate.mockImplementation(async (_callback, argument) => {
      if (argument && typeof argument === 'object') return { error: 'INVALID_SELECTOR' } as never
      return (argument ? true : 'document') as never
    })
    const execution = createExecutionService()
    try {
      await expect(execution.enqueue(createAccessibilityTask(input, browser.session)).result).rejects.toMatchObject({ code: 'INVALID_SELECTOR' })
      expect(execution.available).toBe(true)
      await expect(execution.enqueue({ run: () => 'next' }).result).resolves.toBe('next')
    }
    finally { await execution.close() }
  })

  it('keeps cleanup failure visible and quarantines the lane', async () => {
    const browser = createPreviewBrowserFixture({ close: async () => {
      throw new Error('close failed')
    } })
    browser.page.evaluate.mockImplementation(async (_callback, argument) => {
      if (argument && typeof argument === 'object') return { error: 'CAPABILITY_UNAVAILABLE' } as never
      return (argument ? true : 'document') as never
    })
    const execution = createExecutionService()
    try {
      await expect(execution.enqueue(createAccessibilityTask(input, browser.session)).result).rejects.toMatchObject({ code: 'CLEANUP_UNCONFIRMED' })
      expect(execution.available).toBe(false)
      expect(() => execution.enqueue({ run: () => 'must not start' })).toThrow('unavailable')
    }
    finally { await execution.close().catch(() => {}) }
  })
})
