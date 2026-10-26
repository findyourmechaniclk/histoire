<script setup lang="ts">
import type { UiAgentPlanEntry } from '@histoire/shared'
import { BuiltinIcon, HstPulsatingDisc } from '@histoire/controls/vue'
import { computed, ref } from 'vue'
import AgentDisclosure from './AgentDisclosure.vue'

const props = defineProps<{
  /** Plan entries in agent order. */
  entries: readonly UiAgentPlanEntry[]
  /** The agent is still working on this plan. */
  live?: boolean
}>()
/** Completed entry count. */
const done = computed(() => props.entries.filter(entry => entry.status === 'completed').length)
/** User toggle; `undefined` follows the default (open until every entry is done). */
const toggled = ref<boolean>()
const open = computed(() => toggled.value ?? done.value < props.entries.length)
/** Static glyph per settled status; live running entries use the pulsating disc. */
const icons: Record<UiAgentPlanEntry['status'], string> = { pending: 'circle-dash', in_progress: 'in-progress', completed: 'checkmark-filled' }
</script>

<template>
  <section class="htw:min-w-0 htw:mb-1.5 htw:text-[11px] htw:text-muted" aria-label="Agent plan">
    <AgentDisclosure :aria-expanded="open" @click="toggled = !open">
      <BuiltinIcon class="htw:[transition:transform_120ms_ease-out] htw:data-[open=true]:rotate-90 htw:motion-reduce:transition-none" :data-open="open" icon="chevron-right" :size="12" />
      <BuiltinIcon icon="list-checked" :size="14" />
      <strong class="htw:text-body htw:font-semibold">Plan</strong>
      <span class="summary">{{ done }}/{{ entries.length }} done</span>
    </AgentDisclosure>
    <!-- Escape the status underscore: Tailwind turns unescaped arbitrary-value underscores into spaces. -->
    <ol v-if="open" class="htw:grid htw:gap-0.75 htw:mt-0.5 htw:mx-0 htw:mb-1 htw:pt-0 htw:pr-0 htw:pb-0 htw:pl-4.5 htw:list-none">
      <li v-for="(entry, index) in entries" :key="index" :data-status="entry.status" class="htw:flex htw:items-start htw:gap-1.5 htw:min-w-0 htw:leading-[1.45] htw:group/entry">
        <HstPulsatingDisc v-if="live && entry.status === 'in_progress'" class="status htw:flex-none htw:w-3 htw:mt-0.5 htw:group-data-[status=completed]/entry:text-accent-link" :size="10" />
        <BuiltinIcon v-else class="status htw:flex-none htw:w-3 htw:mt-0.5 htw:group-data-[status=completed]/entry:text-accent-link" :icon="icons[entry.status]" :size="12" />
        <span class="content htw:min-w-0 htw:wrap-anywhere htw:group-data-[status=in\_progress]/entry:text-body htw:group-data-[status=in\_progress]/entry:font-semibold htw:group-data-[status=completed]/entry:line-through">{{ entry.content }}</span>
      </li>
    </ol>
  </section>
</template>
