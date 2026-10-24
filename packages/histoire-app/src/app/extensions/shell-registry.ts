import type { ContributionKind, QualifiedContribution } from '@histoire/plugin-kit'
import type { WorkbenchHost } from './create-workbench-host.js'
import { BUILTIN_NAMESPACE, createContributionKeys, parseQualifiedId } from '@histoire/plugin-kit'

/**
 * Whether a plugin destination (pane, settings section) can be shown:
 * - `available`: registered and available in the root context;
 * - `pending`: not registered yet, but plugin setup has not settled, so it may still appear;
 * - `missing`: never valid, or setup settled without it (unknown, removed, dev-only in a static book).
 */
export type ContributionPresence = 'available' | 'pending' | 'missing'

/** Live registry view of one root-scoped contribution kind, consumed by shell guards. */
export interface ContributionLookup<K extends ContributionKind = ContributionKind> {
  /** Ordered contributions available in the root context (dev-only ones only for dev sources). */
  list: () => ReadonlyArray<QualifiedContribution<K>>
  /** Presence of one candidate id; non-plugin ids are always `missing`. */
  presence: (id: unknown) => ContributionPresence
  /** Notified on registry, context and readiness changes; returns its disposer. */
  subscribe: (listener: () => void) => () => void
}

/**
 * Whether `value` is syntactically a plugin-qualified id (`<plugin>:<id>`), not a built-in one.
 * @param value Candidate route or persisted value.
 */
export function isPluginContributionId(value: unknown): value is `${string}:${string}` {
  if (typeof value !== 'string') return false
  const parsed = parseQualifiedId(value)
  return parsed !== null && parsed.namespace !== BUILTIN_NAMESPACE
}

/**
 * Presence of `id` among `available` contributions.
 * @param id Candidate id.
 * @param available Contributions currently available.
 * @param settled Whether plugin setup settled.
 */
function resolvePresence(id: unknown, available: ReadonlyArray<{ id: string }>, settled: boolean): ContributionPresence {
  if (!isPluginContributionId(id)) return 'missing'
  if (available.some(contribution => contribution.id === id)) return 'available'
  return settled ? 'missing' : 'pending'
}

/**
 * Stable render key of one contribution object. A re-registered contribution with the same
 * id is a new object, so keying views by it remounts them.
 */
export const contributionKey = createContributionKeys()

/** Lookup used when no extension host exists: every plugin destination is missing. */
export function createEmptyContributionLookup<K extends ContributionKind>(): ContributionLookup<K> {
  return { list: () => [], presence: () => 'missing', subscribe: () => () => {} }
}

/**
 * Creates a registry view of one root-scoped kind (`shell.pane`, `settings.section`,
 * `home.section`). Reads are lazy, so guards created before plugins load stay correct.
 * @param workbench Extension host of the workbench.
 * @param kind Contribution kind.
 */
export function createContributionLookup<K extends ContributionKind>(workbench: WorkbenchHost, kind: K): ContributionLookup<K> {
  const { host, context } = workbench
  let settled = false
  const ready = host.ready.then(() => {
    settled = true
  })
  /** Available contributions in the root context. */
  const list = (): ReadonlyArray<QualifiedContribution<K>> => host.available(kind, context as never) as ReadonlyArray<QualifiedContribution<K>>
  return {
    list,
    presence: id => resolvePresence(id, list(), settled),
    subscribe(listener) {
      let active = true
      const stop = host.subscribe(listener)
      // Readiness is not a registry change: a host whose plugins registered nothing never
      // notifies, yet pending ids must resolve to missing once setup settled.
      void ready.then(() => {
        if (active) listener()
      })
      return () => {
        active = false
        stop()
      }
    },
  }
}
