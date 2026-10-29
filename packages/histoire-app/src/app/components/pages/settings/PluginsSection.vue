<script setup lang="ts">
import { BuiltinIcon, HstButton, HstPulsatingDisc, HstSwitch } from '@histoire/controls/vue'
import { installedPlugins } from 'virtual:$histoire-config'
import { useContributionLookup } from '../../../composables/shell-extensions.js'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'
import PluginIcon from './PluginIcon.vue'
import SettingsCard from './SettingsCard.vue'
import SettingsRow from './SettingsRow.vue'
import { usePluginToggles } from './usePluginToggles.js'

const emit = defineEmits<{ section: [section: string] }>()
const dev = __HISTOIRE_DEV__
const sections = useContributionLookup('settings.section')
const toggles = usePluginToggles()
</script>

<template>
  <section class="htw:w-[min(100%,_740px)] htw:mx-auto">
    <h1 class="htw:text-[25px] htw:font-bold htw:m-[0_0_22px]">
      Plugins
    </h1>
    <SettingsCard v-if="installedPlugins.length">
      <SettingsRow v-for="(plugin, index) in installedPlugins" :key="index" wrap>
        <PluginIcon :logo-url="plugin.logoUrl" :icon="plugin.icon" />
        <div class="htw:flex-1 htw:min-w-0">
          <div class="htw:flex htw:flex-wrap htw:items-center htw:gap-2">
            <strong class="htw:break-all">{{ plugin.displayName || plugin.name }}</strong>
            <span v-if="plugin.builtin" class="htw:rounded-[5px] htw:bg-chip htw:px-1.5 htw:py-0.5 htw:text-[10px] htw:font-medium htw:text-muted">Built in</span>
          </div>
          <span v-if="plugin.description" class="htw:block htw:text-muted htw:text-[12px]">{{ plugin.description }}</span>
        </div>
        <HstButton v-if="plugin.docsUrl" as="a" color="default" :href="plugin.docsUrl" target="_blank" rel="noopener noreferrer" :aria-label="`Documentation for ${plugin.displayName || plugin.name}`">
          <BuiltinIcon icon="document" :size="16" />
          Documentation
        </HstButton>
        <HstButton v-if="plugin.repoUrl" as="a" color="default" :href="plugin.repoUrl" target="_blank" rel="noopener noreferrer" :aria-label="`Repository for ${plugin.displayName || plugin.name}`">
          <BuiltinIcon icon="code" :size="16" />
          Repository
        </HstButton>
        <HstButton v-for="item in sections.list().filter(section => plugin.id && section.pluginId === plugin.id)" :key="item.id" icon-only color="default" type="button" :aria-label="`Settings: ${item.label}`" title="Settings" @click="emit('section', item.id)">
          <BuiltinIcon icon="settings" :size="16" />
        </HstButton>
        <HstSwitch v-if="dev && plugin.toggleId" layout="inline" :aria-label="`Enable ${plugin.displayName || plugin.name}`" :model-value="toggles.value(plugin.toggleId, plugin.enabled)" :disabled="toggles.pending.value" @update:model-value="toggles.set(plugin.toggleId, $event)" />
        <span v-else-if="dev && !plugin.builtin" class="htw:text-muted htw:text-[12px]" title="Edit this plugin in your Histoire config">Edit config</span>
      </SettingsRow>
    </SettingsCard>
    <WorkbenchEmptyState v-else icon="puzzle" title="No plugins installed" />
    <div v-if="dev && (toggles.changes.value.length || toggles.pending.value || toggles.error.value)" role="region" aria-label="Plugin changes" class="htw:sticky htw:bottom-4 htw:z-10 htw:ms-auto htw:mt-4 htw:flex htw:w-max htw:max-w-full htw:flex-wrap htw:items-center htw:justify-end htw:gap-2 htw:rounded-[12px] htw:bg-surface htw:p-2 htw:shadow-panel">
      <span v-if="toggles.error.value" role="alert" class="htw:text-danger-text htw:text-[12px]">
        {{ toggles.error.value }}
      </span>
      <span v-else-if="!toggles.pending.value" class="htw:px-1 htw:text-muted htw:text-[12px]">
        {{ toggles.changes.value.length }} {{ toggles.changes.value.length === 1 ? 'change' : 'changes' }}
      </span>
      <HstButton color="default" :disabled="toggles.pending.value" @click="toggles.discard()">
        <BuiltinIcon icon="close" :size="16" />
        Discard
      </HstButton>
      <HstButton :disabled="toggles.pending.value || !toggles.changes.value.length" @click="toggles.apply()">
        <HstPulsatingDisc v-if="toggles.pending.value" :size="12" />
        <BuiltinIcon v-else icon="renew" :size="16" />
        {{ toggles.pending.value ? 'Restarting Histoire' : 'Apply and restart' }}
      </HstButton>
    </div>
  </section>
</template>
