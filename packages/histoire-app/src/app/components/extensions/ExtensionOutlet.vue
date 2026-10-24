<script setup lang="ts">
import type { ContributionKind, ExtensionHost, QualifiedContribution } from '@histoire/plugin-kit'
import { createContributionKeys } from '@histoire/plugin-kit'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useExtensionHost } from '../../composables/extensions.js'
import ExtensionView from './ExtensionView.vue'

const props = defineProps<{
  /** Contribution kind rendered by this placement. */
  kind: ContributionKind
  /** Surface context; decides availability and is pushed to every view. */
  context: unknown
  /** Narrows the placement, e.g. inspector sections of one tab and position. */
  filter?: (contribution: QualifiedContribution) => boolean
  /** Extension host; defaults to the nearest workbench's host. */
  host?: ExtensionHost
}>()
defineSlots<{
  /** Shown while plugins are still setting up and nothing is rendered yet. */
  pending?: () => any
  /** Wraps or replaces each view; defaults to `ExtensionView`. */
  default?: (props: { contribution: QualifiedContribution, context: unknown }) => any
}>()

const host = props.host ?? useExtensionHost().host
// Registry snapshots are not reactive: a host notification bumps this revision.
const revision = ref(0)
const ready = ref(false)
const stop = host.subscribe(() => revision.value++)
onBeforeUnmount(stop)
host.ready.then(() => {
  ready.value = true
})

/** Ordered contributions of this placement available in the current context. */
const contributions = computed(() => {
  void revision.value
  const available = host.available(props.kind, props.context as never) as ReadonlyArray<QualifiedContribution>
  return props.filter ? available.filter(props.filter) : available
})

// Keys follow contribution objects: a re-registered contribution with the same id remounts.
const keyOf = createContributionKeys()
</script>

<template>
  <slot v-if="!ready && !contributions.length" name="pending" />
  <template v-for="contribution in contributions" :key="keyOf(contribution)">
    <slot :contribution="contribution" :context="context">
      <ExtensionView :contribution="contribution" :context="context" :host="host" />
    </slot>
  </template>
</template>
