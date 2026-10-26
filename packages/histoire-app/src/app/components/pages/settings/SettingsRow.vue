<script setup lang="ts">
defineProps<{
  /** Native element retains form submission semantics when needed. */
  as?: 'div' | 'form'
  /** Policy choices wrap without inspecting package-owned markup. */
  wrap?: boolean
  /** Viewport rows retain their own vertical density at narrow widths. */
  viewport?: boolean
}>()
defineSlots<{
  /** Setting label and interactive control. */
  default?: () => any
}>()
</script>

<template>
  <component :is="as ?? 'div'" :data-wrap="wrap" class="htw:flex htw:items-center htw:gap-[18px] htw:px-5 htw:[border-bottom:1px_solid_var(--histoire-border,_#e4e4e7)] htw:last:[border-bottom:0] htw:[@media(max-width:_600px)]:gap-[8px] htw:[@media(max-width:_600px)]:flex-wrap htw:[@media(max-width:_600px)]:px-[14px] htw:data-[wrap=true]:flex-wrap" :class="viewport ? 'htw:py-row-viewport' : 'htw:py-row-settings htw:[@media(max-width:_600px)]:py-[calc(var(--histoire-settings-row-padding,_20px)_-_6px)]'">
    <slot />
  </component>
</template>
