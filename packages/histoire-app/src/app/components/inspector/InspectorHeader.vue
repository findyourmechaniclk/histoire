<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { isContextMenuShortcut } from '../../composables/context-menu.js'

defineProps<{
  /** Selected story's catalog title. */
  storyTitle: string
  /** Selected variant title, absent when selection is unresolved. */
  variantTitle?: string
  /** Standalone adapter's isolated preview URL. */
  isolatedHref?: string
}>()
const emit = defineEmits<{ close: [], contextmenu: [event: MouseEvent | KeyboardEvent] }>()

/** Header actions expose their story context menu to keyboard users. */
function onKeydown(event: KeyboardEvent): void {
  if (isContextMenuShortcut(event)) emit('contextmenu', event)
}
</script>

<template>
  <header class="htw:flex htw:flex-none htw:items-center htw:gap-[8px] htw:box-border htw:h-pane-header htw:py-0 htw:px-inspector-gutter" @contextmenu="$emit('contextmenu', $event)" @keydown="onKeydown">
    <div class="htw:flex htw:items-center htw:gap-[6px] htw:flex-1 htw:min-w-0">
      <span v-if="variantTitle && variantTitle !== storyTitle" class="htw:flex htw:items-center htw:gap-[4px] htw:min-w-0 htw:max-w-[50%] htw:text-muted htw:text-[13px] htw:whitespace-nowrap"><span class="htw:overflow-hidden htw:text-ellipsis">{{ storyTitle }}</span><BuiltinIcon class="htw:flex-none" icon="chevron-right" :size="12" /></span>
      <h2 class="htw:m-0 htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap htw:text-[15px] htw:leading-[1.3] htw:font-extrabold">
        {{ variantTitle || storyTitle }}
      </h2>
    </div>
    <a v-if="isolatedHref" :href="isolatedHref" target="_blank" rel="noopener noreferrer" class="histoire-icon-button htw:[--histoire-icon-button-size:28px] htw:text-muted htw:hover:bg-chip htw:hover:text-text" aria-label="Open in new tab" title="Open in new tab">
      <BuiltinIcon icon="launch" :size="16" />
    </a>
    <HstButton icon-only color="flat" type="button" class="htw:[--histoire-icon-button-size:28px] htw:text-muted htw:hover:bg-chip htw:hover:text-text" aria-label="Close inspector" title="Close inspector" @click="$emit('close')">
      <BuiltinIcon icon="close" :size="16" />
    </HstButton>
  </header>
</template>
