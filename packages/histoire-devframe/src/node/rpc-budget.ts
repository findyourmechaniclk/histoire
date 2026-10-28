/** Bound Devframe calls until birpc itself settles, including after local abort. */
export function createRpcBudget(limit: number) {
  let pending = 0
  return {
    /** Reserve before invoking upstream, then release only on actual settlement. */
    call<T>(operation: () => Promise<T>): Promise<T> {
      if (pending >= limit) throw new Error('Transport capacity reached')
      pending++
      let result: Promise<T>
      try {
        result = Promise.resolve(operation())
      }
      catch (error) {
        pending--
        throw error
      }
      void result.then(() => {
        pending--
      }, () => {
        pending--
      })
      return result
    },
  }
}
