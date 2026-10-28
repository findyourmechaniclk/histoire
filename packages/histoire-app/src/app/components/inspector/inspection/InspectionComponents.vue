<script setup lang="ts">
import type { HistoireComponentInspection, HistoireComponentTreeInspection, HistoireReadonly } from '@histoire/protocol'
import { HstButton } from '@histoire/controls/vue'
import { computed } from 'vue'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'

const props = defineProps<{
  /** Detached tree belonging to the current actor. */
  tree: HistoireReadonly<HistoireComponentTreeInspection>
  /** Selected component's detached details, if loaded. */
  details?: HistoireReadonly<HistoireComponentInspection>
  /** Current actor supports component detail reads. */
  canReadDetails: boolean
  /** Another inspection is in progress. */
  running: boolean
}>()
const emit = defineEmits<{ select: [id: string] }>()
/** Parent labels preserve hierarchy without exposing runtime instances. */
const labels = computed(() => new Map(props.tree.nodes.map(node => [node.id, node.name])))
</script>

<template>
  <section aria-label="Components" class="htw:px-pane-gutter htw:pb-pane-gutter">
    <h3 class="htw:text-text">
      Components
    </h3>
    <p v-if="tree.coverage === 'partial'" class="htw:text-muted">
      Partial coverage: {{ tree.limitations.join(', ') }}
    </p>
    <p v-if="tree.truncated || tree.omittedCount" class="htw:text-muted">
      Some components were omitted
    </p>
    <WorkbenchEmptyState v-if="!tree.nodes.length" icon="search" title="No components" />
    <ul v-else>
      <li v-for="node in tree.nodes" :key="node.id">
        <HstButton v-if="canReadDetails" color="flat" type="button" :disabled="running" @click="emit('select', node.id)">
          {{ node.name }}
        </HstButton>
        <span v-else>{{ node.name }}</span>
        <span v-if="node.parentId" class="htw:text-muted"> in {{ labels.get(node.parentId) }}</span>
      </li>
    </ul>
    <section v-if="details" aria-label="Component details">
      <h4>Component details</h4>
      <pre class="htw:overflow-auto htw:whitespace-pre-wrap">{{ JSON.stringify({ props: details.props, ...(details.state ? { state: details.state } : {}) }, null, 2) }}</pre>
    </section>
  </section>
</template>
