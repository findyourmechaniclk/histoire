<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue'
import { useContributionLookup } from '../../../composables/shell-extensions.js'
import { contributionKey, isPluginContributionId } from '../../../extensions/shell-registry.js'
import { normalizeSettingsSection } from '../../../stores/settings.js'
import ExtensionView from '../../extensions/ExtensionView.vue'
import WorkbenchLoadingState from '../../shell/WorkbenchLoadingState.vue'
import SettingsCard from './SettingsCard.vue'
import SettingsNav from './SettingsNav.vue'

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
  <div class="htw:flex htw:h-full htw:min-h-0 htw:bg-canvas htw:text-text htw:[@media(max-width:_600px)]:flex-col">
    <SettingsNav :section="section" :dev="dev" @section="emit('section', $event)" />
    <main class="histoire-settings-content htw:flex-1 htw:min-w-0 htw:overflow-auto htw:p-[42px_6%] htw:[@media(600px<width<=900px)]:p-[28px_24px] htw:[@media(max-width:_600px)]:p-[24px_14px]">
      <component :is="sections[section as keyof typeof sections]" v-if="!isPluginContributionId(section)" :build-info="buildInfo" />
      <!-- Plugin preferences live in the plugin's own namespace and never offer "Save to project". -->
      <section v-else-if="pluginSection && plugins.workbench" class="htw:w-[min(100%,_740px)] htw:mx-auto">
        <h1 class="htw:text-[25px] htw:font-bold htw:m-[0_0_22px]">
          {{ pluginSection.label }}
        </h1>
        <!-- Card like built-in sections; inside it the pane gutter is the settings row inset. -->
        <SettingsCard class="histoire-settings-plugin htw:[--histoire-pane-gutter:20px] htw:[@media(max-width:_600px)]:[--histoire-pane-gutter:14px]">
          <ExtensionView :key="contributionKey(pluginSection)" :contribution="pluginSection" :context="plugins.workbench.context" />
        </SettingsCard>
      </section>
      <WorkbenchLoadingState v-else title="Loading settings" />
    </main>
  </div>
</template>
