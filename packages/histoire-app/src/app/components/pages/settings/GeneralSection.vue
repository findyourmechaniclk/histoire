<script setup lang="ts">
import { HstButton, HstSwitch } from '@histoire/controls/vue'
import { defineAsyncComponent } from 'vue'
import { useUiSettingsStore } from '../../../stores/settings.js'
import { histoireConfig } from '../../../util/config.js'
import SettingsCard from './SettingsCard.vue'
import SettingsChoices from './SettingsChoices.vue'
import SettingsRow from './SettingsRow.vue'

const SaveToProject = __HISTOIRE_DEV__ ? defineAsyncComponent(() => import('./SaveToProject.vue')) : undefined
const settings = useUiSettingsStore()!
</script>

<template>
  <section class="htw:w-[min(100%,_740px)] htw:mx-auto">
    <h1 class="htw:text-[25px] htw:font-bold htw:m-[0_0_22px]">
      General
    </h1><SettingsCard>
      <SettingsRow wrap>
        <strong class="htw:first:flex-1">Default arrangement</strong><SettingsChoices aria-label="Default arrangement" :model-value="settings.defaultArrange.value ?? histoireConfig.ui?.defaultArrange ?? 'grid'" :options="[{ value: 'single', label: 'Single variant' }, { value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }]" @update:model-value="settings.setArrange($event)" />
      </SettingsRow>
      <SaveToProject v-if="SaveToProject" path="ui.defaultArrange" :value="settings.defaultArrange.value ?? histoireConfig.ui?.defaultArrange ?? 'grid'" :project-value="histoireConfig.ui?.defaultArrange" :local="settings.defaultArrange.value !== undefined" @reset="settings.setArrange(undefined)" @saved="settings.setArrange(undefined)" />
      <SettingsRow>
        <label class="htw:first:flex-1" for="histoire-sync-zoom">Sync zoom across stories</label><HstSwitch id="histoire-sync-zoom" class="htw:ms-auto" layout="inline" :model-value="settings.state.syncZoom" @update:model-value="settings.update({ syncZoom: $event })" />
      </SettingsRow>
      <SettingsRow>
        <strong class="htw:first:flex-1">Local preferences</strong><HstButton color="default" type="button" @click="settings.reset">
          Reset preferences
        </HstButton>
      </SettingsRow>
    </SettingsCard>
  </section>
</template>
