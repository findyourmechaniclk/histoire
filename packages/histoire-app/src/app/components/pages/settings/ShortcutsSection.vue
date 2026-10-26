<script setup lang="ts">
import { computed } from 'vue'
import { useShortcutRegistry } from '../../../util/shortcuts.js'
import SettingsCard from './SettingsCard.vue'
import SettingsRow from './SettingsRow.vue'

const registry = useShortcutRegistry()
const entries = computed(() => [...(registry?.reference.values() ?? [])].filter(item => __HISTOIRE_DEV__ || !item.devOnly))
/** Conflict display uses actual registry bindings; no second shortcut definition source. */
function conflicts(id: string): boolean {
  const entry = registry?.reference.get(id)
  return Boolean(entry && entries.value.some(other => other.id !== id && other.scope === entry.scope && other.keys.some(key => entry.keys.includes(key))))
}
</script>

<template>
  <section class="htw:w-[min(100%,_740px)] htw:mx-auto">
    <h1 class="htw:text-[25px] htw:font-bold htw:m-[0_0_22px]">
      Keyboard shortcuts
    </h1><SettingsCard>
      <SettingsRow v-for="entry in entries" :key="entry.id">
        <strong class="htw:first:flex-1">{{ entry.label }}</strong><kbd>{{ registry?.hint(entry.id) }}</kbd><span v-if="conflicts(entry.id)" role="status">Conflict</span>
      </SettingsRow><SettingsRow v-if="!entries.length">
        No shortcuts registered.
      </SettingsRow>
    </SettingsCard>
  </section>
</template>
