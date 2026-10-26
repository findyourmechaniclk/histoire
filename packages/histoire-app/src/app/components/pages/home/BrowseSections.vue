<script setup lang="ts">
import type { HistoireSelectionInput } from '@histoire/protocol'
import type { BrowseSection } from './catalog.js'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import HomeHeading from './HomeHeading.vue'

defineProps<{
  /** Real top-level folder/group counts and destinations. */
  sections: BrowseSection[]
  /** Dev overview uses compact cards with live status. */
  compact?: boolean
}>()
defineEmits<{
  /** Navigate to first real story within section. */
  select: [target: HistoireSelectionInput]
}>()
</script>

<template>
  <section v-if="sections.length">
    <HomeHeading>
      Browse
    </HomeHeading>
    <div class="htw:grid htw:[grid-template-columns:repeat(3,_minmax(0,_1fr))] htw:gap-[12px] htw:[@media(max-width:_1100px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] htw:[@media(max-width:_600px)]:[grid-template-columns:minmax(0,_1fr)]">
      <HstButton v-for="section in sections" :key="section.id" color="flat" type="button" class="htw:overflow-hidden htw:[border:1px_solid_var(--histoire-border)] htw:rounded-[14px] htw:bg-surface htw:border-border htw:text-left htw:not-disabled:[&:hover]:border-accent htw:not-disabled:[&:hover]:bg-surface htw:focus-visible:[outline-offset:3px] htw:flex htw:flex-col htw:items-start htw:justify-start htw:gap-[10px] htw:p-[16px] htw:text-text" @click="$emit('select', section.target)">
        <div class="htw:flex htw:items-center htw:gap-[10px] htw:w-full">
          <span class="htw:grid htw:[flex:0_0_36px] htw:place-items-center htw:h-[36px] htw:rounded-[9px] htw:bg-accent-soft htw:text-accent"><BuiltinIcon class="htw:w-[19px] htw:h-[19px]" :icon="section.stories ? 'cube' : 'document'" :size="16" /></span>
          <div class="htw:flex-1 htw:min-w-0">
            <strong class="htw:block htw:text-[13px]">{{ section.title }}</strong><span class="htw:block htw:mt-[2px] htw:text-muted htw:text-[11px]">{{ section.stories }} {{ section.stories === 1 ? 'story' : 'stories' }}<template v-if="section.variants"> · {{ section.variants }} variants</template><template v-if="section.guides"> · {{ section.guides }} guides</template></span>
          </div>
          <slot name="status" :section="section" />
        </div>
        <p v-if="!compact" class="htw:overflow-hidden htw:w-full htw:m-[3px_0_0] htw:text-body htw:text-[12px] htw:text-ellipsis htw:whitespace-nowrap">
          {{ section.storyTitles.slice(0, 5).join(', ') }}{{ section.storyTitles.length > 5 ? '…' : '' }}
        </p>
      </HstButton>
    </div>
  </section>
</template>
