<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { useContributionLookup } from '../../../composables/shell-extensions.js'
import { resolveContributionIcon } from '../../../extensions/icons.js'
import { SETTINGS_SECTIONS } from '../../../stores/settings.js'

const props = defineProps<{ section: string, dev: boolean }>()
const emit = defineEmits<{ section: [section: string] }>()
/** Plugin sections, listed after built-ins; dev-only ones are already absent from static books. */
const plugins = useContributionLookup('settings.section')
</script>

<template>
  <nav class="htw:w-[280px] htw:[flex:0_0_280px] htw:flex htw:min-[601px]:flex-col htw:gap-[3px] htw:p-[20px_8px_16px] htw:bg-surface htw:[border-inline-end:1px_solid_var(--histoire-border,_#e4e4e7)] htw:[@media(600px<width<=900px)]:w-[210px] htw:[@media(600px<width<=900px)]:basis-[210px] htw:[@media(max-width:_600px)]:w-auto htw:[@media(max-width:_600px)]:basis-auto htw:[@media(max-width:_600px)]:flex-row htw:[@media(max-width:_600px)]:flex-wrap htw:[@media(max-width:_600px)]:p-[8px]" aria-label="Settings sections">
    <strong class="htw:p-[0_10px_16px] htw:text-[15px] htw:[@media(max-width:_600px)]:hidden">Settings</strong>
    <HstButton v-for="item in SETTINGS_SECTIONS.filter(item => dev || !('devOnly' in item))" :key="item.id" class="htw:flex htw:items-center htw:justify-start htw:gap-[10px] htw:min-[601px]:w-full htw:p-[11px_10px] htw:border-0 htw:rounded-[9px] htw:bg-transparent htw:text-inherit htw:text-start htw:[font:inherit] htw:cursor-pointer htw:[&[aria-current='page']]:bg-chip htw:[&[aria-current='page']]:text-text htw:[&[aria-current='page']]:font-semibold htw:[@media(max-width:_600px)]:w-auto htw:[@media(max-width:_600px)]:p-[8px] htw:[@media(max-width:_600px)]:text-[12px]" color="flat" type="button" :aria-current="props.section === item.id ? 'page' : undefined" @click="emit('section', item.id)">
      <BuiltinIcon class="htw:w-[18px] htw:text-muted htw:text-[18px] htw:[@media(max-width:_600px)]:hidden" :icon="{ general: 'settings', appearance: 'color-palette', viewports: 'laptop', tests: 'chemistry', agents: 'bot', mcp: 'plug', shortcuts: 'keyboard', about: 'information' }[item.id]" :size="18" />
      {{ item.label }}
    </HstButton>
    <HstButton v-for="item in plugins.list()" :key="item.id" class="htw:flex htw:items-center htw:justify-start htw:gap-[10px] htw:min-[601px]:w-full htw:p-[11px_10px] htw:border-0 htw:rounded-[9px] htw:bg-transparent htw:text-inherit htw:text-start htw:[font:inherit] htw:cursor-pointer htw:[&[aria-current='page']]:bg-chip htw:[&[aria-current='page']]:text-text htw:[&[aria-current='page']]:font-semibold htw:[@media(max-width:_600px)]:w-auto htw:[@media(max-width:_600px)]:p-[8px] htw:[@media(max-width:_600px)]:text-[12px]" color="flat" type="button" :aria-current="props.section === item.id ? 'page' : undefined" @click="emit('section', item.id)">
      <BuiltinIcon class="htw:w-[18px] htw:text-muted htw:text-[18px] htw:[@media(max-width:_600px)]:hidden" :icon="resolveContributionIcon(item)" :size="18" />
      {{ item.label }}
    </HstButton>
    <footer class="htw:mt-auto htw:p-[16px_10px_0] htw:text-[11px] htw:text-muted htw:[@media(max-width:_600px)]:hidden">
      Saved to localStorage · project defaults from <code>histoire.config</code>
    </footer>
  </nav>
</template>
