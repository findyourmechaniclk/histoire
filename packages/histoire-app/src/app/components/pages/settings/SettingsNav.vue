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
  <nav class="histoire-settings-nav" aria-label="Settings sections">
    <strong>Settings</strong>
    <HstButton v-for="item in SETTINGS_SECTIONS.filter(item => dev || !('devOnly' in item))" :key="item.id" color="flat" type="button" :aria-current="props.section === item.id ? 'page' : undefined" @click="emit('section', item.id)">
      <BuiltinIcon class="histoire-settings-nav-icon" :icon="{ general: 'settings', appearance: 'color-palette', viewports: 'laptop', tests: 'chemistry', agents: 'bot', mcp: 'plug', shortcuts: 'keyboard', about: 'information' }[item.id]" :size="18" />
      {{ item.label }}
    </HstButton>
    <HstButton v-for="item in plugins.list()" :key="item.id" color="flat" type="button" :aria-current="props.section === item.id ? 'page' : undefined" @click="emit('section', item.id)">
      <BuiltinIcon class="histoire-settings-nav-icon" :icon="resolveContributionIcon(item)" :size="18" />
      {{ item.label }}
    </HstButton>
    <footer>Saved to localStorage · project defaults from <code>histoire.config</code></footer>
  </nav>
</template>
