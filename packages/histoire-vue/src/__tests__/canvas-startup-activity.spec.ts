import { afterEach, describe, expect, it, vi } from 'vitest'
import { setCanvasStartupBusy, whenCanvasStartupIdle } from '../../../histoire-app/src/app/components/canvas/canvas-startup-activity.js'

const owners = [{}, {}]

afterEach(() => {
  for (const owner of owners) setCanvasStartupBusy(owner, false)
  vi.useRealTimers()
})

describe('canvas startup activity', () => {
  it('runs right away when no canvas is starting frames', () => {
    const run = vi.fn()
    whenCanvasStartupIdle(run)
    expect(run).toHaveBeenCalledOnce()
  })

  it('waits until every canvas finished starting its frames', () => {
    const run = vi.fn()
    setCanvasStartupBusy(owners[0], true)
    setCanvasStartupBusy(owners[1], true)
    whenCanvasStartupIdle(run)
    setCanvasStartupBusy(owners[0], false)
    expect(run).not.toHaveBeenCalled()
    setCanvasStartupBusy(owners[1], false)
    expect(run).toHaveBeenCalledOnce()
    setCanvasStartupBusy(owners[1], true)
    setCanvasStartupBusy(owners[1], false)
    expect(run).toHaveBeenCalledOnce()
  })

  it('stops waiting after the maximum delay, and never runs once cancelled', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const cancelled = vi.fn()
    setCanvasStartupBusy(owners[0], true)
    whenCanvasStartupIdle(run, 1000)
    whenCanvasStartupIdle(cancelled, 1000)()
    vi.advanceTimersByTime(1000)
    expect(run).toHaveBeenCalledOnce()
    setCanvasStartupBusy(owners[0], false)
    expect(run).toHaveBeenCalledOnce()
    expect(cancelled).not.toHaveBeenCalled()
  })
})
