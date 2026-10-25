import { describe, expect, it } from 'vitest'
import { getCollectThreadCount } from '../collect/threads.js'

/**
 * Collection workers wait on the main thread, which transforms modules for all
 * of them: in dev, more than a few workers only cost CPU and memory.
 */
describe('getCollectThreadCount', () => {
  it('uses at most 4 dev workers by default', () => {
    expect(getCollectThreadCount('dev', 32)).toBe(4)
    expect(getCollectThreadCount('dev', 4)).toBe(2)
    expect(getCollectThreadCount('dev', 1)).toBe(1)
  })

  it('follows collectMaxThreads in dev up to half the cores', () => {
    expect(getCollectThreadCount('dev', 32, 12)).toBe(12)
    expect(getCollectThreadCount('dev', 32, 64)).toBe(16)
    expect(getCollectThreadCount('dev', 32, 0)).toBe(1)
  })

  it('keeps all but one core for builds', () => {
    expect(getCollectThreadCount('build', 32)).toBe(31)
    expect(getCollectThreadCount('build', 32, 8)).toBe(8)
    expect(getCollectThreadCount('build', 1)).toBe(1)
  })
})
