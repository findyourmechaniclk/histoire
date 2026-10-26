<script setup lang="ts">
import type { HistoireCatalogStory, HistoireSelectionInput } from '@histoire/protocol'
import type { HistoireBuildInfo } from '@histoire/shared'
import { BuiltinIcon } from '@histoire/controls/vue'
import { computed, ref } from 'vue'
import HomeCard from './HomeCard.vue'
import HomeHeading from './HomeHeading.vue'
import HomeRow from './HomeRow.vue'

const props = defineProps<{
  /** Published change identities; omitted when Git diff is unavailable. */
  changed?: HistoireBuildInfo['changed']
  /** Current live catalog resolves labels and retired story identities. */
  stories: readonly HistoireCatalogStory[]
  /** Dev labels working-tree changes; static labels release changes. */
  dev?: boolean
}>()
defineEmits<{
  /** Select a known changed story. */
  select: [target: HistoireSelectionInput]
}>()
const expanded = ref(false)
const changes = computed(() => (props.changed ?? []).flatMap((change) => {
  const story = props.stories.find(story => story.id === change.storyId)
  return story ? [{ ...change, story }] : []
}))
const visible = computed(() => expanded.value ? changes.value : changes.value.slice(0, 20))
</script>

<template>
  <section v-if="changes.length">
    <HomeHeading>
      {{ dev ? 'Uncommitted changes' : 'Updated in this release' }} <span class="htw:text-muted htw:text-[10px]">{{ changes.length }}</span><small v-if="dev" class="htw:text-muted htw:text-[10px] htw:p-[2px_5px] htw:rounded-[5px] htw:bg-chip">DEV</small>
    </HomeHeading>
    <HomeCard>
      <HomeRow v-for="change in visible" :key="change.storyId" color="flat" type="button" @click="$emit('select', change.story.docsOnly ? { storyId: change.storyId, variantId: null } : { storyId: change.storyId })">
        <BuiltinIcon class="htw:flex-none htw:text-accent" :icon="change.story.docsOnly ? 'document' : 'cube'" :size="16" />
        <span class="htw:flex-1 htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap">{{ change.story.title }}</span>
        <small class="htw:flex-none htw:p-[2px_6px] htw:rounded-[5px] htw:bg-chip htw:text-muted htw:text-[10px] htw:font-bold htw:[&[data-kind='new']]:bg-accent-soft htw:[&[data-kind='new']]:text-accent" :data-kind="change.kind">{{ change.kind === 'new' ? 'New' : 'Changed' }}</small>
      </HomeRow>
      <HomeRow v-if="!expanded && changes.length > 20" muted color="flat" type="button" class="htw:justify-center htw:text-[12px] htw:hover:text-text" @click="expanded = true">
        +{{ changes.length - 20 }} more
      </HomeRow>
    </HomeCard>
  </section>
</template>
