<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'

defineProps<{
  /** Stable visible annotation ordinal. */
  number?: number
  /** Current draft/status needs user attention. */
  active?: boolean
  /** Unsent comments use neutral styling. */
  draft?: boolean
  /** Unsaved picked point uses the active compose-board plus cue. */
  temporary?: boolean
  /** Resolved annotations show a check instead of their ordinal. */
  resolved?: boolean
}>()
const emit = defineEmits<{
  /** Reveal this annotation's thread. */
  select: []
}>()
</script>

<template>
  <!-- Pin geometry/background override controls; active text retains the package pressed color. -->
  <HstButton icon-only color="flat" type="button" class="htw:[--histoire-icon-button-size:28px] htw:h-[30px] htw:rounded-[50%_50%_50%_4px] htw:text-[11px] htw:font-bold htw:text-white htw:bg-agent/85 htw:shadow-[0_1px_4px_rgb(0_0_0_/_0.35)] htw:hover:bg-agent htw:data-[active=true]:bg-agent htw:data-[draft=true]:bg-muted htw:data-[resolved=true]:bg-muted htw:data-[active=true]:[outline:3px_solid_rgb(var(--histoire-agent-rgb)/0.25)] htw:data-[active=true]:outline-offset-2 htw:focus-visible:[outline:2px_solid_var(--histoire-agent)] htw:focus-visible:outline-offset-3" :data-active="active" :data-draft="draft" :data-resolved="resolved" :aria-label="temporary ? 'Current comment draft' : `Open ${resolved ? 'resolved ' : ''}comment ${number}`" :aria-pressed="active" @click.stop="emit('select')">
    <BuiltinIcon v-if="temporary" icon="add" :size="14" />
    <BuiltinIcon v-else-if="resolved" icon="checkmark" :size="14" />
    <template v-else>
      {{ number }}
    </template>
  </HstButton>
</template>
