<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'

/** Menu rows share layout and native disabled semantics across root and submenu. */
defineProps<{ label: string, icon?: string, shortcut?: string, disabled?: string, submenu?: boolean, ai?: boolean }>()
</script>

<template>
  <HstButton color="flat" type="button" role="menuitem" tabindex="-1" class="htw:flex htw:w-full htw:min-h-[31px] htw:items-center htw:justify-start htw:gap-2.5 htw:py-1.5 htw:px-[9px] htw:text-body htw:text-left" :disabled="Boolean(disabled)" :aria-disabled="Boolean(disabled)" :title="disabled" :aria-haspopup="submenu ? 'menu' : undefined">
    <BuiltinIcon v-if="icon" :icon="icon" :size="16" class="htw:block htw:flex-none" :class="ai ? 'htw:text-agent' : 'htw:text-muted'" /><span>{{ label }}</span><span v-if="shortcut" class="htw:ml-auto htw:text-muted htw:font-mono htw:text-[10px] htw:font-normal">{{ shortcut }}</span><BuiltinIcon v-if="submenu" class="htw:ml-auto htw:block htw:flex-none" :class="ai ? 'htw:text-agent' : 'htw:text-muted'" icon="chevron-right" :size="12" /><slot />
  </HstButton>
</template>
