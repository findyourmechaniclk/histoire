<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { computed, useAttrs, useId, useSlots } from 'vue'
import { useOverflowToolbar } from '../../base/overflow/context.js'
import { useToolbarPresentation } from '../../base/overflow/presentation.js'

/** Uniform canvas control with native button semantics. */
const props = withDefaults(defineProps<{
  /** Accessible action name and visible dropdown label. */
  label: string
  /** Optional Carbon glyph. */
  icon?: string
  /** Explicit icon sizing when a slot only supplies menu content. */
  iconOnly?: boolean
  /** Toggle or exclusive-choice selection state. */
  pressed?: boolean
  /** Native disabled state. */
  disabled?: boolean
  /** Shortcut metadata, visible in dropdown. */
  shortcut?: string
  /** Additional disabled reason without expanding action label. */
  description?: string
  /** Exclusive choices opt into radio semantics in dropdown. */
  menuRole?: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio'
}>(), { pressed: undefined, iconOnly: undefined })
const attrs = useAttrs()
const slots = useSlots()
const { toolbar, overflow } = useOverflowToolbar()
/** Native icon-only geometry stays square in inline presentation. */
function isIconButton(): boolean {
  return !overflow?.value && (props.iconOnly ?? (Boolean(props.icon) && !slots.default))
}
const descriptionId = useId()
const role = computed(() => overflow?.value ? props.menuRole ?? (props.pressed === undefined ? 'menuitem' : 'menuitemcheckbox') : undefined)

/** Ordinary actions dismiss dropdown; panel triggers keep parent available. */
function click(): void {
  if (overflow?.value && !attrs['aria-haspopup']) toolbar?.close(true)
}

const presentation = useToolbarPresentation()
</script>

<template>
  <HstButton :icon-only="isIconButton()" :data-icon-only="isIconButton()" color="flat" type="button" :data-presentation="presentation" class="histoire-toolbar-button htw:[--histoire-icon-button-size:28px] htw:inline-flex htw:items-center htw:justify-center htw:gap-[5px] htw:min-w-7 htw:h-7 htw:py-0 htw:px-[5px] htw:data-[icon-only=true]:p-0 htw:text-muted htw:whitespace-nowrap htw:data-[presentation=menu]:justify-start htw:data-[presentation=menu]:w-full htw:data-[presentation=menu]:h-auto htw:data-[presentation=menu]:min-h-8 htw:data-[presentation=menu]:py-1.5 htw:data-[presentation=menu]:px-2 htw:data-[presentation=menu]:gap-[9px] htw:data-[presentation=menu]:text-start htw:data-[presentation=menu]:whitespace-normal htw:group/toolbar-button" :role="role" :tabindex="overflow ? -1 : undefined" :aria-label="label" :title="description ?? (shortcut ? `${label} (${shortcut})` : label)" :aria-describedby="description ? descriptionId : undefined" :aria-pressed="role || pressed === undefined ? undefined : pressed" :aria-checked="role && role !== 'menuitem' ? pressed : undefined" :disabled="disabled" @click="click">
    <BuiltinIcon v-if="icon" class="htw:block htw:flex-none" :icon="icon" :size="16" />
    <span class="htw:hidden htw:group-data-[presentation=menu]/toolbar-button:inline htw:group-data-[presentation=menu]/toolbar-button:flex-1">{{ label }}</span>
    <span v-if="$slots.default" class="htw:contents htw:group-data-[presentation=menu]/toolbar-button:inline-flex htw:group-data-[presentation=menu]/toolbar-button:items-center htw:group-data-[presentation=menu]/toolbar-button:gap-1 htw:group-data-[presentation=menu]/toolbar-button:text-muted"><slot /></span>
    <span v-if="shortcut" class="htw:[line-height:normal] htw:hidden htw:text-muted htw:font-mono htw:text-[11px] htw:group-data-[presentation=menu]/toolbar-button:inline">{{ shortcut }}</span>
    <span v-if="description" :id="descriptionId" class="htw:absolute htw:w-px htw:h-px htw:overflow-hidden htw:[clip-path:inset(50%)]">{{ description }}</span>
  </HstButton>
</template>
