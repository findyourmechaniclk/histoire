<script setup lang="ts">
import { HstSwitch } from '@histoire/controls/vue'
import { useUiSettingsStore } from '../../../stores/settings.js'
import SettingsCard from './SettingsCard.vue'
import SettingsRow from './SettingsRow.vue'

const settings = useUiSettingsStore()!
</script>

<template>
  <section class="htw:w-[min(100%,_740px)] htw:mx-auto">
    <h1 class="htw:text-[25px] htw:font-bold htw:m-[0_0_22px]">
      Tests
    </h1><SettingsCard>
      <SettingsRow>
        <label class="htw:first:flex-1" for="histoire-watch-tests">Watch tests</label><HstSwitch id="histoire-watch-tests" class="htw:ms-auto" layout="inline" :model-value="settings.state.watchTests" @update:model-value="settings.update({ watchTests: $event })" />
      </SettingsRow>
    </SettingsCard>
  </section>
</template>
