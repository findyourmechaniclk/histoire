<script setup lang="ts">
import { version } from '../../../../../package.json'
import SettingsCard from './SettingsCard.vue'
import SettingsRow from './SettingsRow.vue'

const props = defineProps<{ buildInfo?: { version?: string, commit?: string, branch?: string, builtAt?: string } }>()
</script>

<template>
  <section class="htw:w-[min(100%,_740px)] htw:mx-auto">
    <h1 class="htw:text-[25px] htw:font-bold htw:m-[0_0_22px]">
      About
    </h1><SettingsCard>
      <SettingsRow>
        <strong class="htw:first:flex-1">Histoire</strong><code>{{ version }}</code>
      </SettingsRow><SettingsRow v-if="props.buildInfo?.version">
        <strong class="htw:first:flex-1">Project version</strong><code>{{ props.buildInfo.version }}</code>
      </SettingsRow><SettingsRow v-if="props.buildInfo?.commit">
        <strong class="htw:first:flex-1">Commit</strong><code>{{ props.buildInfo.commit.slice(0, 8) }}</code>
      </SettingsRow><SettingsRow v-if="props.buildInfo?.branch">
        <strong class="htw:first:flex-1">Branch</strong><code>{{ props.buildInfo.branch }}</code>
      </SettingsRow><SettingsRow v-if="props.buildInfo?.builtAt">
        <strong class="htw:first:flex-1">Built</strong><time>{{ props.buildInfo.builtAt }}</time>
      </SettingsRow>
    </SettingsCard>
  </section>
</template>
