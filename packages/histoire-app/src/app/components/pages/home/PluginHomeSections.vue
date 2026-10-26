<script setup lang="ts">
import type { HomeSectionContribution, QualifiedContribution } from '@histoire/plugin-kit'
import { useOptionalExtensionHost } from '../../../composables/shell-extensions.js'
import ExtensionOutlet from '../../extensions/ExtensionOutlet.vue'
import ExtensionView from '../../extensions/ExtensionView.vue'
import HomeHeading from './HomeHeading.vue'

const props = defineProps<{
  /** Home column receiving the sections. */
  column: HomeSectionContribution['column']
}>()

/** Absent outside a workbench: the home page then shows built-in sections only. */
const extensions = useOptionalExtensionHost()

/**
 * Keeps sections of this column.
 * @param section Available home section.
 */
function inColumn(section: QualifiedContribution): boolean {
  return (section as QualifiedContribution<'home.section'>).column === props.column
}

/**
 * Heading of one home section.
 * @param section Available home section.
 */
function titleOf(section: QualifiedContribution): string {
  return (section as QualifiedContribution<'home.section'>).title
}
</script>

<template>
  <ExtensionOutlet v-if="extensions" kind="home.section" :host="extensions.host" :context="extensions.context" :filter="inColumn">
    <template #default="{ contribution, context }">
      <section>
        <HomeHeading>
          {{ titleOf(contribution) }}
        </HomeHeading>
        <ExtensionView :contribution="contribution" :context="context" :host="extensions.host" />
      </section>
    </template>
  </ExtensionOutlet>
</template>
