<script setup lang="ts">
import type { UiAiThread, UiAiThreadDraft } from '@histoire/shared'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { computed } from 'vue'
import CommentContextChip from './CommentContextChip.vue'
import { compactSelectorPath, propsSummary, selectorParts } from './presentation'

const props = defineProps<{
  /** Composer provides its own dividing border. */
  borderless?: boolean
  /** Human-readable story and variant. */
  title: string
  /** Persisted pinned thread or canvas draft. */
  thread: UiAiThread | UiAiThreadDraft
  /** Show a control collapsing the card back to its pin. */
  minimizable?: boolean
  /** Screenshot is shown as an attachment elsewhere (composer). */
  hideScreenshot?: boolean
}>()
const emit = defineEmits<{
  /** Collapse card back to its pin. */
  minimize: []
}>()

/** Picked element split into story root label, its deepest path segments, and readable full path for tooltip. */
const element = computed(() => {
  const selector = props.thread.anchor?.selector
  if (!selector) return null
  const parts = selectorParts(selector)
  const label = parts.storyRoot ? 'Story root' : 'Element'
  return { label, path: compactSelectorPath(parts.path), full: parts.storyRoot ? [label, parts.path].filter(Boolean).join(' > ') : selector }
})

/** Captured prop values shown inline; tooltip lists one per line. */
const propLines = computed(() => propsSummary(props.thread.props))
</script>

<template>
  <header :class="borderless ? '' : 'htw:border-b htw:border-border'" class="htw:flex htw:flex-col htw:gap-2 htw:py-2.5 htw:px-3">
    <div class="htw:flex htw:items-center htw:gap-1.5 htw:min-w-0 htw:min-h-6 htw:text-text htw:text-[12px] htw:font-semibold">
      <BuiltinIcon icon="cube" :size="13" class="htw:flex-none htw:text-muted" />
      <span class="htw:flex-1 htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap">{{ title }}</span>
      <div v-if="minimizable || $slots.actions" class="htw:flex-none htw:flex htw:gap-0.5 htw:-mt-0.5 htw:-mr-1 htw:-mb-0.5 htw:ml-0 htw:[--histoire-icon-button-size:24px] htw:text-muted">
        <slot name="actions" />
        <HstButton v-if="minimizable" icon-only color="flat" type="button" aria-label="Minimize comment" title="Minimize" class="htw:text-muted" @click="emit('minimize')">
          <BuiltinIcon icon="subtract" :size="16" class="htw:flex-none htw:text-muted" />
        </HstButton>
      </div>
    </div>
    <div v-if="element || propLines.length || (thread.screenshot && !hideScreenshot)" class="htw:flex htw:gap-1 htw:min-w-0">
      <CommentContextChip v-if="element" :label="element.label" icon="code" :title="element.full" :detail="element.path" />
      <CommentContextChip v-if="propLines.length" label="Props" icon="settings-adjust" :title="propLines.join('\n')" :detail="propLines.join(', ')" />
      <CommentContextChip v-if="thread.screenshot && !hideScreenshot" label="Screenshot" icon="camera" :title="thread.screenshot" />
    </div>
  </header>
</template>
