import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLoadingDelay } from '../../../histoire-shared/src/loading-delay.js'

afterEach(() => vi.useRealTimers())

describe('loading delay', () => {
  it('suppresses quick loads and shows longer loads until they finish', () => {
    vi.useFakeTimers()
    const changes: boolean[] = []
    const delay = createLoadingDelay(visible => changes.push(visible))
    delay.setPending(true)
    vi.advanceTimersByTime(99)
    expect(changes).toEqual([])
    delay.setPending(false)
    vi.advanceTimersByTime(100)
    expect(changes).toEqual([])
    delay.setPending(true)
    vi.advanceTimersByTime(100)
    expect(changes).toEqual([true])
    delay.setPending(false)
    expect(changes).toEqual([true, false])
    delay.dispose()
  })

  it('restarts after cancellation and cannot publish after disposal', () => {
    vi.useFakeTimers()
    const changes: boolean[] = []
    const delay = createLoadingDelay(visible => changes.push(visible))
    delay.setPending(true)
    vi.advanceTimersByTime(80)
    delay.setPending(false)
    delay.setPending(true)
    vi.advanceTimersByTime(99)
    expect(changes).toEqual([])
    delay.dispose()
    vi.advanceTimersByTime(100)
    expect(changes).toEqual([])
  })
})
