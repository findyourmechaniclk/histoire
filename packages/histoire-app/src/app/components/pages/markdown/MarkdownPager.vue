<script setup lang="ts">
import type { HistoireCatalogStory, HistoireSelectionInput } from '@histoire/protocol'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'

defineProps<{
  /** Previous guide in same-group tree order. */
  previous?: HistoireCatalogStory
  /** Next guide in same-group tree order. */
  next?: HistoireCatalogStory
}>()
defineEmits<{
  /** Guide selection never mounts synthetic variants. */
  select: [target: HistoireSelectionInput]
}>()
</script>

<template>
  <nav v-if="previous || next" class="htw:flex htw:gap-[12px] htw:mt-[28px]" aria-label="Documentation pages">
    <HstButton v-if="previous" class="htw:flex htw:flex-1 htw:items-center htw:gap-[12px] htw:min-w-0 htw:p-[18px_16px] htw:text-text htw:text-left htw:hover:border-accent" color="flat" type="button" @click="$emit('select', { storyId: previous.id, variantId: null })">
      <BuiltinIcon icon="chevron-left" :size="16" /><div class="htw:flex-1 htw:min-w-0">
        <small class="htw:block htw:mb-[6px] htw:text-muted htw:text-[11px]">Previous</small><strong class="htw:block">{{ previous.title }}</strong>
      </div>
    </HstButton>
    <HstButton v-if="next" color="flat" type="button" class="htw:flex htw:flex-1 htw:items-center htw:gap-[12px] htw:min-w-0 htw:p-[18px_16px] htw:text-text htw:text-right htw:last:ml-auto htw:hover:border-accent" @click="$emit('select', { storyId: next.id, variantId: null })">
      <div class="htw:flex-1 htw:min-w-0">
        <small class="htw:block htw:mb-[6px] htw:text-muted htw:text-[11px]">Next</small><strong class="htw:block">{{ next.title }}</strong>
      </div><BuiltinIcon icon="chevron-right" :size="16" />
    </HstButton>
  </nav>
</template>
