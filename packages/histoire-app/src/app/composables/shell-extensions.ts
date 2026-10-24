import type { ContributionKind } from '@histoire/plugin-kit'
import type { WorkbenchHost } from '../extensions/create-workbench-host.js'
import type { ContributionLookup } from '../extensions/shell-registry.js'
import { onScopeDispose, ref } from 'vue'
import { createContributionLookup, createEmptyContributionLookup } from '../extensions/shell-registry.js'
import { useOptionalExtensionHost } from './extensions.js'

export { useOptionalExtensionHost } from './extensions.js'

/** Reactive registry view of one root-scoped contribution kind. */
export interface ReactiveContributionLookup<K extends ContributionKind> extends ContributionLookup<K> {
  /** Extension host backing the lookup, absent outside a workbench. */
  readonly workbench: WorkbenchHost | undefined
}

/**
 * Registry view of one root-scoped kind whose reads are tracked by Vue: computeds and
 * templates reading `list()` or `presence()` re-run on registry, context and readiness changes.
 * The subscription lives as long as the calling component or effect scope.
 * @param kind Contribution kind.
 * @param workbench Extension host; defaults to the nearest workbench's (a workbench cannot inject its own).
 */
export function useContributionLookup<K extends ContributionKind>(kind: K, workbench = useOptionalExtensionHost()): ReactiveContributionLookup<K> {
  const lookup: ContributionLookup<K> = workbench ? createContributionLookup(workbench, kind) : createEmptyContributionLookup<K>()
  // Registry snapshots are not reactive: a notification bumps this revision.
  const revision = ref(0)
  onScopeDispose(lookup.subscribe(() => revision.value++))
  return {
    workbench,
    list: () => {
      void revision.value
      return lookup.list()
    },
    presence: (id) => {
      void revision.value
      return lookup.presence(id)
    },
    subscribe: lookup.subscribe,
  }
}
