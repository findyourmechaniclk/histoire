import { describe, expect, it, vi } from 'vitest'
import { onHistoireDarkChange, registerHistoireDarkSource } from '../../../../histoire-shared/src/runtime-dark.js'

describe('runtime dark mode', () => {
  it('follows the registered dark mode source and stops on unsubscribe', () => {
    // No Histoire runtime (collection, unit tests): listeners never run.
    const early = vi.fn()
    onHistoireDarkChange(early)()
    expect(early).not.toHaveBeenCalled()

    const listeners = new Set<(dark: boolean) => void>()
    const unregister = registerHistoireDarkSource((listener) => {
      listener(true)
      listeners.add(listener)
      return () => listeners.delete(listener)
    })
    const listener = vi.fn()
    const stop = onHistoireDarkChange(listener)
    expect(listener).toHaveBeenCalledWith(true)
    stop()
    expect(listeners.size).toBe(0)
    unregister()
  })
})
