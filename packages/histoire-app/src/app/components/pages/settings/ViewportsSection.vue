<script setup lang="ts">
import type { ResponsivePreset } from '@histoire/shared'
import type { PresetOwner } from '../../../stores/presets-config.js'
import { BuiltinIcon, HstButton, HstNumber, HstText } from '@histoire/controls/vue'
import { defineAsyncComponent, ref } from 'vue'
import { usePresetConfigStore } from '../../../stores/presets-config.js'
import { histoireConfig } from '../../../util/config.js'
import SettingsCard from './SettingsCard.vue'
import SettingsRow from './SettingsRow.vue'

const props = defineProps<{ embedded?: boolean }>()
const SaveToProject = __HISTOIRE_DEV__ ? defineAsyncComponent(() => import('./SaveToProject.vue')) : undefined
const presets = usePresetConfigStore()!
const editing = ref<PresetOwner | 'new' | null>(null)
const draft = ref<Omit<ResponsivePreset, 'height'> & { height?: number | null | '' }>({ label: '', width: 1024, height: 640 })
const error = ref('')
/** Existing row identity survives collection removals and HMR reordering. */
function edit(index: number | null): void {
  const owner = index === null ? 'new' : presets.viewportOwner(index)
  if (!owner) return
  editing.value = owner
  draft.value = index === null ? { label: '', width: 1024, height: 640 } : { ...presets.responsivePresets.value[index] }
  error.value = ''
}
/** Validation remains in shared preset owner so toolbar never sees invalid dimensions. */
function save(): void {
  try {
    const value: ResponsivePreset = { ...draft.value, height: draft.value.height === '' || draft.value.height == null ? null : draft.value.height }
    if (editing.value === 'new') presets.addViewport(value)
    else if (editing.value) presets.updateViewport(editing.value, value)
    editing.value = null
  }
  catch (reason) { error.value = reason instanceof Error ? reason.message : String(reason) }
}
</script>

<template>
  <section class="htw:w-[min(100%,_740px)] htw:mx-auto" :class="{ 'histoire-settings-embedded': props.embedded }">
    <h1 v-if="!embedded" class="htw:text-[25px] htw:font-bold htw:m-[0_0_22px]">
      Viewports
    </h1>
    <SettingsCard>
      <header class="htw:flex htw:items-center htw:justify-between htw:gap-[10px] htw:p-[13px_20px] htw:[border-bottom:1px_solid_var(--histoire-border,_#e4e4e7)]">
        <strong>Viewport presets</strong><HstButton color="default" class="htw:inline-flex htw:items-center htw:gap-[6px]" type="button" @click="edit(null)">
          + Add preset
        </HstButton>
      </header>
      <SettingsRow v-for="(preset, index) in presets.responsivePresets.value" :key="presets.viewportKey(index)" viewport>
        <BuiltinIcon :icon="preset.width < 600 ? 'mobile' : preset.width < 1000 ? 'tablet' : preset.width < 1280 ? 'laptop' : 'screen'" :size="17" /><strong class="htw:first:flex-1 htw:flex-1">{{ preset.label }}</strong><code class="htw:w-[125px] htw:text-muted htw:text-[12px]">{{ preset.width }} × {{ preset.height ?? 'Auto' }}</code>
        <HstButton icon-only color="default" class="htw:border-0 htw:bg-transparent htw:[&:hover]:bg-transparent htw:text-muted" type="button" :aria-label="`Edit ${preset.label}`" @click="edit(index)">
          <BuiltinIcon icon="edit" :size="15" />
        </HstButton>
        <HstButton icon-only color="default" class="htw:border-0 htw:bg-transparent htw:[&:hover]:bg-transparent htw:text-muted" type="button" :aria-label="`Remove ${preset.label}`" @click="presets.removeViewport(index)">
          <BuiltinIcon icon="trash-can" :size="15" />
        </HstButton>
      </SettingsRow>
      <SettingsRow v-if="editing !== null" as="form" @submit.prevent="save">
        <HstText v-model="draft.label" layout="inline" class="htw:min-w-0" aria-label="Preset name" placeholder="Name" required />
        <HstNumber v-model="draft.width" layout="inline" class="htw:min-w-0 htw:w-[90px]" aria-label="Viewport width" min="1" required />
        <HstNumber layout="inline" :model-value="typeof draft.height === 'number' ? draft.height : null" class="htw:min-w-0 htw:w-[90px]" aria-label="Viewport height" min="1" placeholder="Auto" @update:model-value="draft.height = $event" />
        <HstButton color="default" type="submit">
          Save
        </HstButton><HstButton color="default" type="button" @click="editing = null">
          Cancel
        </HstButton>
        <span v-if="error" role="alert">{{ error }}</span>
      </SettingsRow>
      <SaveToProject v-if="SaveToProject" path="responsivePresets" :value="presets.responsivePresets.value" :project-value="histoireConfig.responsivePresets" :local="presets.viewportsOverridden.value" @reset="presets.resetViewports" @saved="presets.resetViewports" />
      <div v-else-if="presets.viewportsOverridden.value" class="htw:flex htw:flex-wrap htw:items-center htw:gap-[8px] htw:p-[10px_20px] htw:text-[12px]">
        <HstButton color="default" type="button" @click="presets.resetViewports">
          Reset to project
        </HstButton>
      </div>
    </SettingsCard>
  </section>
</template>
