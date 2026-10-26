<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { useHistoireContext } from '@histoire/vue/internal'
import { computed, ref, shallowRef } from 'vue'
import BasePopover from '../base/popover/BasePopover.vue'

const props = defineProps<{
  /** Offline Carbon glyph name shown before label. */
  icon: string
  /** Short visible action label. */
  label: string
  /** Disables main action and options trigger. */
  disabled?: boolean
  /** Accessible name of options trigger and its menu. */
  menuLabel?: string
  /** Options menu width in pixels. */
  menuWidth?: number
}>()
const emit = defineEmits<{
  /** Main action activated. */
  click: [event: MouseEvent]
}>()
defineSlots<{
  /** Optional secondary options; renders split chevron trigger when present. */
  menu?: (props: { close: () => void }) => any
}>()

const context = useHistoireContext()
const open = ref(false)
const chevron = shallowRef<InstanceType<typeof HstButton> | null>(null)
const anchor = computed(() => (chevron.value?.element as HTMLElement | undefined) ?? null)
const resolvedMenuLabel = computed(() => props.menuLabel ?? `${props.label} options`)

/** Dismiss options menu after an item runs. */
function close(): void {
  open.value = false
}
</script>

<template>
  <div class="htw:inline-flex htw:flex-none htw:gap-px htw:[--histoire-icon-button-size:var(--histoire-control-height,34px)]">
    <HstButton color="primary" type="button" class="htw:box-border htw:h-control htw:py-0 htw:px-2.5 htw:font-[750] htw:whitespace-nowrap" :class="{ 'htw:rounded-e-none': $slots.menu }" :disabled="disabled" @click="emit('click', $event)">
      <BuiltinIcon :icon="icon" :size="16" />{{ label }}
    </HstButton>
    <template v-if="$slots.menu">
      <HstButton ref="chevron" color="primary" type="button" class="htw:rounded-s-none" icon-only :aria-label="resolvedMenuLabel" aria-haspopup="menu" :aria-expanded="open" :disabled="disabled" @click="open = !open">
        <BuiltinIcon icon="chevron-down" :size="16" />
      </HstButton>
      <BasePopover v-if="open" v-model:open="open" :anchor="anchor" :label="resolvedMenuLabel" role="menu" :width="menuWidth ?? 160" :overlay-target="context.overlay.value ?? context.root.value">
        <slot name="menu" :close="close" />
      </BasePopover>
    </template>
  </div>
</template>
