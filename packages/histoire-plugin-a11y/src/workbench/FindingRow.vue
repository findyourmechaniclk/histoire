<script setup lang="ts">
import type { AuditReport } from '../messages.js'
import { HstButton } from '@histoire/controls/vue'
import { nodeKey } from '../scanner/run.js'

defineProps<{
  /** Bounded finding from exact actor. */
  rule: AuditReport['violations'][number]
  /** Outcome category owning node handles. */
  outcome: string
}>()
const emit = defineEmits<{
  /** Highlight one private element handle. */
  highlight: [key: string]
}>()
</script>

<template>
  <details class="histoire-a11y-rule">
    <summary>
      <span class="histoire-a11y-impact" :data-impact="rule.impact">{{ rule.impact ?? 'unknown' }}</span>
      <strong>{{ rule.help }}</strong>
      <span>{{ rule.nodes.length }} {{ rule.nodes.length === 1 ? 'element' : 'elements' }}</span>
    </summary>
    <div class="histoire-a11y-details">
      <div class="histoire-a11y-rule-link">
        <code>{{ rule.id }}</code><a :href="rule.helpUrl" target="_blank" rel="noopener noreferrer">Rule guidance</a>
      </div>
      <div v-for="(node, index) in rule.nodes" :key="index" class="histoire-a11y-node">
        <code>{{ node.selectors.join(' / ') }}</code>
        <p v-if="node.failureSummary">
          {{ node.failureSummary }}
        </p>
        <HstButton @click="emit('highlight', nodeKey(outcome, rule.id, node.selectors))">
          Highlight
        </HstButton>
      </div>
    </div>
  </details>
</template>
