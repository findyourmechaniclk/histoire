import type { Disposer } from '../types/common.js'

/** Resources acquired by one owner, released exactly once. */
export interface ResourceSet {
  /**
   * Tracks a release callback. Once the set is closed, the callback runs immediately
   * (late acquisitions are disposed on arrival) and a no-op disposer is returned.
   * The returned disposer releases this resource early, exactly once.
   */
  add: (release: () => void) => Disposer
  /** Closes the set and releases every tracked resource in reverse acquisition order. */
  close: () => void
}

/** No-op disposer for registrations refused by a retired scope. */
export const NOOP: Disposer = () => {}

/**
 * Creates a resource set.
 * @param onError Receives errors thrown by release callbacks; release continues with the next one.
 */
export function createResourceSet(onError: (error: unknown) => void): ResourceSet {
  const tracked = new Set<() => void>()
  let closed = false

  /**
   * Runs one release callback, routing its error.
   * @param release Callback to run.
   */
  function run(release: () => void): void {
    try {
      release()
    }
    catch (error) {
      onError(error)
    }
  }

  return {
    add(release) {
      if (closed) {
        run(release)
        return NOOP
      }
      // Wrapper identity marks the entry; removing it first makes reentrant calls no-ops.
      const entry = (): void => {
        if (tracked.delete(entry)) run(release)
      }
      tracked.add(entry)
      return entry
    },
    close() {
      if (closed) return
      closed = true
      // Entries may release others reentrantly; each removes itself before running.
      for (const entry of [...tracked].reverse()) entry()
    },
  }
}
