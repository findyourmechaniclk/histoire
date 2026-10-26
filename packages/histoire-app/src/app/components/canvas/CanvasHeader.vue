<script setup lang="ts">
import type { HistoireCatalogStory } from '@histoire/sdk'
import { BuiltinIcon } from '@histoire/controls/vue'
import { isHistoireProjectFileOrigin } from '@histoire/protocol'
import { computed } from 'vue'
import CanvasStatus from './CanvasStatus.vue'

const props = withDefaults(defineProps<{
  /** Selected portable story metadata. */
  story: HistoireCatalogStory
  /** Whether the current story can be opened through the development editor. */
  canOpenInEditor?: boolean
}>(), { canOpenInEditor: false })
const emit = defineEmits<{ openInEditor: [] }>()
const editorLabel = computed(() => `Open ${props.story.relativePath ?? ''} in editor`)
const showFile = computed(() => !!props.story.relativePath && isHistoireProjectFileOrigin(props.story.fileOrigin))
</script>

<template>
  <header class="histoire-canvas-heading htw:flex htw:items-center htw:justify-between htw:gap-4 htw:min-w-0">
    <div class="htw:flex htw:flex-1 htw:items-baseline htw:gap-3 htw:min-w-0">
      <h1 class="htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap htw:m-0 htw:text-[24px] htw:font-extrabold htw:leading-[1.2] htw:tracking-[-.02em] htw:text-text">
        {{ story.title }}
      </h1><span class="htw:text-muted htw:text-[12px] htw:shrink-0 htw:whitespace-nowrap">{{ story.variants.length }} {{ story.variants.length === 1 ? 'variant' : 'variants' }}</span>
    </div>
    <div class="htw:flex htw:flex-[0_1_45%] htw:flex-col htw:self-start htw:items-stretch htw:gap-[3px] htw:min-w-0">
      <button v-if="showFile && canOpenInEditor" type="button" class="histoire-canvas-file htw:flex htw:w-full htw:min-w-0 htw:items-center htw:justify-end htw:gap-2 htw:overflow-hidden htw:whitespace-nowrap htw:font-mono htw:[@container_canvas-header_(max-width:640px)]:hidden htw:group/file htw:box-border htw:m-0 htw:p-0 htw:border-0 htw:bg-transparent htw:text-inherit htw:[text-align:inherit] htw:cursor-pointer htw:pointer-events-auto htw:focus-visible:outline-2 htw:focus-visible:outline-solid htw:focus-visible:outline-accent htw:focus-visible:outline-offset-2" :aria-label="editorLabel" :title="editorLabel" @pointerdown.stop @click="emit('openInEditor')">
        <BuiltinIcon class="htw:text-muted htw:group-hover/file:text-accent" icon="code" :size="14" />
        <span class="htw:text-muted htw:text-[12px] htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:group-hover/file:text-accent">{{ story.relativePath }}</span>
      </button>
      <span v-else-if="showFile" class="htw:text-muted htw:text-[12px] histoire-canvas-file htw:flex htw:w-full htw:min-w-0 htw:items-center htw:justify-end htw:gap-2 htw:overflow-hidden htw:whitespace-nowrap htw:font-mono htw:[@container_canvas-header_(max-width:640px)]:hidden"><BuiltinIcon icon="code" :size="14" /><span class="htw:text-muted htw:text-[12px] htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:group-hover/file:text-accent">{{ story.relativePath }}</span></span>
      <CanvasStatus />
    </div>
  </header>
</template>
