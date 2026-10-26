<script setup lang="ts">
import type { HistoireCatalogStory, HistoireSelectionInput } from '@histoire/protocol'
import { BuiltinIcon } from '@histoire/controls/vue'
import HomeCard from './HomeCard.vue'
import HomeHeading from './HomeHeading.vue'
import HomeRow from './HomeRow.vue'

defineProps<{
  /** Documentation-only stories in real tree order. */
  guides: HistoireCatalogStory[]
}>()
defineEmits<{
  /** Select documentation without mounting a preview variant. */
  select: [target: HistoireSelectionInput]
}>()
</script>

<template>
  <section v-if="guides.length">
    <HomeHeading>
      Guides
    </HomeHeading>
    <HomeCard>
      <HomeRow v-for="guide in guides" :key="guide.id" color="flat" type="button" class="htw:font-bold" @click="$emit('select', { storyId: guide.id, variantId: null })">
        <BuiltinIcon class="htw:flex-none htw:first:text-accent htw:last:text-muted" icon="document" :size="16" />
        <span class="htw:flex-1 htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap">{{ guide.title }}</span>
        <BuiltinIcon class="htw:flex-none htw:first:text-accent htw:last:text-muted" icon="chevron-right" :size="16" />
      </HomeRow>
    </HomeCard>
  </section>
</template>
