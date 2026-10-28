import { describe, expect, it } from 'vitest'
import { createInspectionTask } from '../../mcp/browser/inspection/task.js'
import { toMcpError } from '../../mcp/protocol/errors.js'
import { mcpToolInputSchemas } from '../../mcp/protocol/tool-schema.js'
import { createExecutionService } from '../../runtime/execution-service.js'
import { createPreviewBrowserFixture } from '../utils/mcp/preview-browser.js'

const input = mcpToolInputSchemas.histoire_inspect_dom.parse({ storyId: 'story', variantId: 'variant', requestKey: 'inspection' })

describe('isolated inspection lifecycle', () => {
  it('times out while waiting for the browser and releases the lane', async () => {
    const waiting = Promise.withResolvers<void>()
    const browser = createPreviewBrowserFixture({ wait: () => waiting.promise, close: async () => waiting.reject(new Error('browser closed')) })
    const execution = createExecutionService()
    try {
      const task = createInspectionTask('inspect-dom', input, { ...browser.session, timeoutMs: 20 })
      const failure = await execution.enqueue(task).result.catch(error => error)
      expect(toMcpError(failure)).toEqual({ code: 'TIMEOUT', message: 'Inspection exceeded its preview deadline', retryable: true })
      expect(execution.available).toBe(true)
      await expect(execution.enqueue({ run: () => 'next' }).result).resolves.toBe('next')
    }
    finally { await execution.close() }
  })

  it('quarantines the lane when browser cleanup cannot be confirmed', async () => {
    const browser = createPreviewBrowserFixture({ close: async () => {
      throw new Error('close failed')
    } })
    browser.frame.evaluate.mockImplementation(async (_callback, options) => typeof options === 'string' ? true as never : { matched: true, nodes: [], truncated: false } as never)
    const execution = createExecutionService()
    try {
      await expect(execution.enqueue(createInspectionTask('inspect-dom', input, browser.session)).result).rejects.toMatchObject({ code: 'CLEANUP_UNCONFIRMED' })
      expect(execution.available).toBe(false)
      expect(() => execution.enqueue({ run: () => 'must not start' })).toThrow('unavailable')
    }
    finally { await execution.close().catch(() => {}) }
  })
})
