/** Track bounded, adapter-owned remote cleanup without closing caller connections. */
export function createRetirementTracker(timeoutMs: number) {
  const pending = new Set<Promise<boolean>>()
  return {
    /** Reserve tracking before invoking a reentrant transport callback. */
    start(operation: () => void | Promise<unknown>) {
      const completion = Promise.withResolvers<boolean>()
      pending.add(completion.promise)
      let finished = false
      const timer = setTimeout(() => finish(false), timeoutMs)
      /** Settle exactly once even when the remote reply arrives after timeout. */
      function finish(success: boolean) {
        if (finished) return
        finished = true
        clearTimeout(timer)
        completion.resolve(success)
      }
      try {
        Promise.resolve(operation()).then(() => finish(true), () => finish(false))
      }
      catch { finish(false) }
      void completion.promise.then(() => pending.delete(completion.promise))
    },
    /** Join every retirement already reserved, reporting failed or stalled cleanup. */
    async drain() {
      const results = await Promise.all([...pending])
      if (results.some(result => !result)) throw new Error('Attachment retirement incomplete')
    },
  }
}
