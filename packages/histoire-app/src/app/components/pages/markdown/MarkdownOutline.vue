<script setup lang="ts">
import type { MarkdownHeading } from './outline-dom.js'
import { HstButton } from '@histoire/controls/vue'

defineProps<{
  /** Current page's h2/h3 renderer anchors. */
  headings: MarkdownHeading[]
  /** Heading nearest current reading position. */
  active: string
}>()
defineEmits<{
  /** Local scroll intent with exact page-owned element. */
  select: [heading: MarkdownHeading]
}>()
</script>

<template>
  <nav v-if="headings.length" class="htw:sticky htw:top-[32px] htw:self-start htw:pt-[72px] htw:[@media(max-width:_1100px)]:hidden" aria-label="On this page">
    <h2 class="htw:m-[0_0_8px] htw:text-muted htw:text-[11px] htw:font-normal">
      On this page
    </h2>
    <HstButton v-for="heading in headings" :key="heading.id" class="htw:flex htw:justify-start htw:w-full htw:p-[6px_10px] htw:border-0 htw:text-muted htw:text-start htw:aria-[current=location]:bg-accent-soft htw:aria-[current=location]:text-text htw:data-[nested=true]:ps-[22px] htw:data-[nested=true]:text-[12px] htw:hover:text-accent-link" color="flat" type="button" :data-nested="heading.level === 3" :aria-current="active === heading.id ? 'location' : undefined" @click="$emit('select', heading)">
      {{ heading.title }}
    </HstButton>
  </nav>
</template>
