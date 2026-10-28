import type { HistoireHighlightLease, HistoireInspectionOwner } from '@histoire/protocol'
import type { HistoireSession } from '@histoire/sdk'

/** Retain exact leases until attachment retirement or natural overlay expiry. */
export function createHighlightOperations(session: Pick<HistoireSession, 'inspect'>, owner: HistoireInspectionOwner) {
  let cleanupFailed = false
  const finishing = new Map<string, Promise<void>>()
  const leases = new Map<string, { lease: HistoireHighlightLease, timer: ReturnType<typeof setTimeout> }>()
  return {
    /** Bound in-flight authority confirmations independently of SDK request concurrency. */
    hasCapacity(pending: number) { return leases.size + pending <= 128 },
    /** Keep the runtime-issued identity private to this attachment. */
    retain(id: string, lease: HistoireHighlightLease) {
      if (leases.size >= 128 || leases.has(id)) throw new Error('Session unavailable')
      const timer = setTimeout(() => leases.delete(id), 5500)
      leases.set(id, { lease, timer })
    },
    /** Clear only the captured lease; a newer overlay is never affected. */
    async finish(id: string, accepted: boolean, signal = AbortSignal.timeout(3000)) {
      const existing = finishing.get(id)
      if (existing) return existing
      const entry = leases.get(id)
      if (!entry || accepted) return
      leases.delete(id)
      clearTimeout(entry.timer)
      const cleanup = session.inspect.clearHighlight({ target: owner.target, expectedOwner: owner, leaseId: entry.lease.leaseId, signal }).then(() => {})
      finishing.set(id, cleanup)
      try {
        await cleanup
      }
      catch (error) {
        cleanupFailed = true
        throw error
      }
      finally { finishing.delete(id) }
    },
    /** Retire retained effects when attachment authority ends. */
    async dispose() {
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error('Highlight cleanup incomplete'))
        }, 3000)
      })
      const cleanup = async () => {
        let failed = cleanupFailed
        // Prioritize recent leases without exhausting the SDK's request capacity.
        for (const id of [...leases.keys()].reverse()) {
          controller.signal.throwIfAborted()
          try {
            await this.finish(id, false, controller.signal)
          }
          catch { failed = true }
        }
        if ((await Promise.allSettled(finishing.values())).some(result => result.status === 'rejected')) failed = true
        if (failed || cleanupFailed) throw new Error('Highlight cleanup incomplete')
      }
      try {
        await Promise.race([cleanup(), timeout])
      }
      finally { clearTimeout(timer) }
    },
  }
}
