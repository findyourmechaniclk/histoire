<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'

defineProps<{
  /** Visible context name, e.g. a story and variant. */
  label: string
  /** Offline glyph name. */
  icon?: string
  /** Tooltip. */
  title?: string
  /** Shows a remove button. */
  removable?: boolean
}>()
const emit = defineEmits<{
  /** Stop sending this context. */
  remove: []
}>()
</script>

<template>
  <span class="htw:inline-flex htw:items-center htw:gap-1.5 htw:max-w-full htw:h-6 htw:pt-0 htw:pr-0.5 htw:pb-0 htw:pl-2 htw:rounded-full htw:bg-chip htw:text-body htw:text-[12px]" :title="title ?? label">
    <BuiltinIcon :icon="icon ?? 'catalog'" :size="12" class="htw:flex-none htw:text-muted" />
    <span class="htw:min-w-0 htw:overflow-hidden htw:text-ellipsis htw:whitespace-nowrap">{{ label }}</span>
    <HstButton v-if="removable" icon-only color="flat" type="button" class="htw:[--histoire-icon-button-size:20px] htw:flex-none htw:rounded-full htw:text-muted" :aria-label="`Remove ${label}`" :title="`Remove ${label}`" @click="emit('remove')">
      <BuiltinIcon icon="close" :size="12" class="htw:flex-none htw:text-muted" />
    </HstButton>
  </span>
</template>
