<script setup lang="ts">
import type { HistoireAccessibilityInspection, HistoireReadonly } from '@histoire/protocol'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'

defineProps<{
  /** Detached findings from the selected actor's explicit audit. */
  audit: HistoireReadonly<HistoireAccessibilityInspection>
}>()
</script>

<template>
  <section aria-label="Accessibility audit" class="htw:px-pane-gutter htw:pb-pane-gutter">
    <h3 class="htw:text-text">
      Accessibility audit
    </h3>
    <WorkbenchEmptyState v-if="!audit.matched" icon="search" title="No matching element" />
    <WorkbenchEmptyState v-else-if="!audit.violations.length && !audit.incomplete.length" icon="checkmark" :title="audit.truncated || audit.droppedCount ? 'No retained findings' : 'No findings'" />
    <template v-else>
      <section v-if="audit.violations.length" aria-label="Violations">
        <h4>Violations</h4>
        <ul>
          <li v-for="finding in audit.violations" :key="finding.id">
            <strong>{{ finding.help }}</strong><span v-if="finding.impact"> — {{ finding.impact }}</span>
            <ul>
              <li v-for="(node, index) in finding.nodes" :key="index">
                <code>{{ node.selectors.join(' › ') }}</code>
                <p v-if="node.failureSummary">
                  {{ node.failureSummary }}
                </p>
              </li>
            </ul>
          </li>
        </ul>
      </section>
      <section v-if="audit.incomplete.length" aria-label="Needs review">
        <h4>Needs review</h4>
        <ul>
          <li v-for="finding in audit.incomplete" :key="finding.id">
            <strong>{{ finding.help }}</strong>
            <ul>
              <li v-for="(node, index) in finding.nodes" :key="index">
                <code>{{ node.selectors.join(' › ') }}</code>
                <p v-if="node.failureSummary">
                  {{ node.failureSummary }}
                </p>
              </li>
            </ul>
          </li>
        </ul>
      </section>
    </template>
    <p v-if="audit.truncated || audit.droppedCount" class="htw:text-muted">
      Some findings were omitted
    </p>
  </section>
</template>
