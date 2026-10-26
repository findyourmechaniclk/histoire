<script setup lang="ts">
import type { HistoireTarget } from '@histoire/protocol'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { useHistoireSnapshot } from '@histoire/vue'
import { computed } from 'vue'
import { createdStories } from './created-stories.js'

const props = defineProps<{
  /** Files changed by the agent in this thread. */
  changes: readonly { file: string }[]
}>()
const emit = defineEmits<{
  /** Navigate to the story. */
  select: [target: HistoireTarget]
}>()
const snapshot = useHistoireSnapshot()
/** Reactive on the catalog, so new stories appear once collected. */
const stories = computed(() => createdStories(props.changes, snapshot.value.catalog.stories))
</script>

<template>
  <nav v-if="stories.length" class="htw:flex htw:flex-wrap htw:gap-1.5 htw:mt-2" aria-label="Stories changed by the agent">
    <HstButton v-for="story in stories" :key="story.id" class="htw:inline-flex htw:items-center htw:gap-1.5 htw:font-semibold" color="flat" type="button" @click="emit('select', { storyId: story.id, variantId: story.variants[0]?.id ?? null })">
      <BuiltinIcon icon="catalog" :size="16" />{{ story.title }}
    </HstButton>
  </nav>
</template>
