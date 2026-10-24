<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue'
import { useContributionLookup } from '../../../composables/shell-extensions.js'
import { contributionKey, isPluginContributionId } from '../../../extensions/shell-registry.js'
import { normalizeSettingsSection } from '../../../stores/settings.js'
import ExtensionView from '../../extensions/ExtensionView.vue'
import WorkbenchLoadingState from '../../shell/WorkbenchLoadingState.vue'
import SettingsNav from './SettingsNav.vue'
import './settings.css'

const props = defineProps<{ section?: string, buildInfo?: { version?: string, commit?: string, branch?: string, builtAt?: string } }>()
const emit = defineEmits<{ section: [section: string] }>()
const dev = __HISTOIRE_DEV__
const plugins = useContributionLookup('settings.section')
// Plugin sections stay while setup is pending; once settled, missing ones recover to Appearance.
const section = computed(() => normalizeSettingsSection(props.section, dev, plugins))
/** Selected plugin section, when registered and available. */
const pluginSection = computed(() => isPluginContributionId(section.value) ? plugins.list().find(item => item.id === section.value) : undefined)
const sections = {
  general: defineAsyncComponent(() => import('./GeneralSection.vue')),
  appearance: defineAsyncComponent(() => import('./AppearanceSection.vue')),
  viewports: defineAsyncComponent(() => import('./ViewportsSection.vue')),
  shortcuts: defineAsyncComponent(() => import('./ShortcutsSection.vue')),
  about: defineAsyncComponent(() => import('./AboutSection.vue')),
  ...(dev
    ? {
        tests: defineAsyncComponent(() => import('./TestsSection.vue')),
        mcp: defineAsyncComponent(() => import('./McpSection.vue')),
        agents: defineAsyncComponent(() => import('./AgentsSection.vue')),
      }
    : {}),
}
watch(section, (value) => {
  if (props.section !== value) emit('section', value)
}, {
  immediate: true,
})
</script>

<template>
  <div class="histoire-settings-page">
    <SettingsNav :section="section" :dev="dev" @section="emit('section', $event)" />
    <main class="histoire-settings-content">
      <component :is="sections[section as keyof typeof sections]" v-if="!isPluginContributionId(section)" :build-info="buildInfo" />
      <!-- Plugin preferences live in the plugin's own namespace and never offer "Save to project". -->
      <section v-else-if="pluginSection && plugins.workbench">
        <h1>{{ pluginSection.label }}</h1>
        <!-- Card like built-in sections; inside it the pane gutter is the settings row inset. -->
        <div class="histoire-settings-card histoire-settings-plugin">
          <ExtensionView :key="contributionKey(pluginSection)" :contribution="pluginSection" :context="plugins.workbench.context" />
        </div>
      </section>
      <WorkbenchLoadingState v-else title="Loading settings" />
    </main>
  </div>
</template>
