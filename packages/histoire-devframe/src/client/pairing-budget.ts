/** Track pairing RPCs by caller-owned connection until upstream settlement. */
const pending = new WeakMap<object, number>()

/** Bound unresolved pairing attempts even when local timeouts settle first. */
export function startPairing<T>(connection: object, operation: () => Promise<T>, timeoutRetentionMs = 60_000): Promise<T> {
  const count = pending.get(connection) ?? 0
  if (count >= 32) throw new Error('Pairing capacity reached')
  pending.set(connection, count + 1)
  /** Release only after the actual Devframe RPC finishes. */
  function release() {
    const remaining = (pending.get(connection) ?? 1) - 1
    if (remaining) pending.set(connection, remaining)
    else pending.delete(connection)
  }
  let result: Promise<T>
  try {
    result = Promise.resolve(operation())
  }
  catch (error) {
    release()
    throw error
  }
  void result.then(release, (error) => {
    // Devframe's client timeout may reject before its underlying birpc call settles.
    if (error && typeof error === 'object' && 'kind' in error && error.kind === 'timeout') {
      const timer = setTimeout(release, timeoutRetentionMs)
      timer.unref?.()
    }
    else {
      release()
    }
  })
  return result
}
