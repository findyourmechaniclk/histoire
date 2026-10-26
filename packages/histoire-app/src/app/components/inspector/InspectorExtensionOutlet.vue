<script setup lang="ts">
import type { ContributionKind, QualifiedContribution } from '@histoire/plugin-kit'
import ExtensionOutlet from '../extensions/ExtensionOutlet.vue'
import ExtensionView from '../extensions/ExtensionView.vue'

defineProps<{
  /** Inspector tab or section contribution kind. */
  kind: ContributionKind
  /** Current frame context passed unchanged to the extension. */
  context: unknown
  /** Placement filter owned by the inspector model. */
  filter: (contribution: QualifiedContribution) => boolean
  /** Footer sections use top spacing outside the scrolling tab body. */
  footer?: boolean
}>()
</script>

<template>
  <ExtensionOutlet :kind="kind" :context="context" :filter="filter">
    <template #default="{ contribution, context: viewContext }">
      <ExtensionView
        :contribution="contribution"
        :context="viewContext"
        :classes="{ root: footer ? 'htw:flex-none htw:pt-pane-gutter htw:px-inspector-gutter htw:pb-0' : 'htw:pt-0 htw:px-inspector-gutter htw:pb-pane-gutter' }"
      />
    </template>
  </ExtensionOutlet>
</template>
