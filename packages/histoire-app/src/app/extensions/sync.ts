import type { ContributionContext, ContributionKind, Disposer, QualifiedContribution } from '@histoire/plugin-kit'
import type { WorkbenchHost } from './create-workbench-host.js'

/**
 * Mirrors the committed contributions of one kind into an existing workbench registry
 * (frame actions, context menu, commands, shortcuts). Each contribution object is registered
 * once and its registration disposed when the object leaves the host registry (plugin teardown,
 * disposer, host disposal); a re-registered contribution is a new object and registers anew.
 * Availability is not mirrored: adapters evaluate it per target through {@link isContributionAvailable}.
 * @param workbench Workbench extension host.
 * @param kind Contribution kind to mirror.
 * @param register Registers one contribution and returns its disposer; must not throw.
 * @returns Disposer removing every mirrored registration and the subscription.
 */
export function syncContributions<K extends ContributionKind>(workbench: WorkbenchHost, kind: K, register: (contribution: QualifiedContribution<K>) => Disposer | void): Disposer {
  const registered = new Map<QualifiedContribution<K>, Disposer | undefined>()
  let last: ReadonlyArray<QualifiedContribution<K>> | undefined

  /** Applies the registry snapshot; same frozen snapshot means nothing of this kind changed. */
  function sync(): void {
    const snapshot = workbench.host.contributions(kind)
    if (snapshot === last) return
    last = snapshot
    const current = new Set(snapshot)
    // Removals first, so a contribution re-registered under the same id never collides with its predecessor.
    for (const [contribution, dispose] of registered) {
      if (current.has(contribution)) continue
      registered.delete(contribution)
      dispose?.()
    }
    for (const contribution of snapshot) {
      if (registered.has(contribution)) continue
      const dispose = register(contribution)
      registered.set(contribution, typeof dispose === 'function' ? dispose : undefined)
    }
  }

  sync()
  const stop = workbench.host.subscribe(sync)
  return () => {
    stop()
    for (const dispose of registered.values()) dispose?.()
    registered.clear()
  }
}

/**
 * Whether one contribution is available in a surface context, with the same rules every surface
 * applies (`devOnly` for non-dev sources, `available` predicate, failed predicates hidden).
 * @param workbench Workbench extension host.
 * @param kind Contribution kind.
 * @param contribution Committed contribution.
 * @param context Surface context.
 */
export function isContributionAvailable<K extends ContributionKind>(workbench: WorkbenchHost, kind: K, contribution: QualifiedContribution<K>, context: ContributionContext<K>): boolean {
  return workbench.host.available(kind, context).includes(contribution)
}
