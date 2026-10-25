/** Canvases (startup coordinators) with frame startups queued or in progress. */
const busyOwners = new Set<object>()
/** Callbacks waiting for every canvas to finish starting its frames. */
const waiters = new Set<() => void>()

/**
 * Records whether one canvas still has frame startups queued or in progress.
 * @param owner Canvas startup coordinator
 * @param busy Whether it has pending startups
 */
export function setCanvasStartupBusy(owner: object, busy: boolean): void {
  if (busy) {
    busyOwners.add(owner)
    return
  }
  busyOwners.delete(owner)
  if (busyOwners.size) return
  for (const waiter of [...waiters]) waiter()
}

/**
 * Runs `run` once no canvas is starting frames. Story frames share the
 * workbench's main thread: background work started meanwhile (e.g. test
 * collection mounting the story again) delays every cell still loading.
 * @param run Work to start
 * @param maxWaitMs Longest wait, so work still starts when a frame never settles
 * @returns Cancels the pending run
 */
export function whenCanvasStartupIdle(run: () => void, maxWaitMs = 10_000): () => void {
  if (!busyOwners.size) {
    run()
    return () => {}
  }
  const waiter = () => {
    cancel()
    run()
  }
  const timer = setTimeout(waiter, maxWaitMs)
  /** Forgets the pending run. */
  function cancel() {
    clearTimeout(timer)
    waiters.delete(waiter)
  }
  waiters.add(waiter)
  return cancel
}
