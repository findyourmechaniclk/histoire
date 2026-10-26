<script setup lang="ts">
import type { BackgroundPreset } from '@histoire/shared'
import type { PresetOwner } from '../../../stores/presets-config.js'
import { HstButton, HstText } from '@histoire/controls/vue'
import { useHistoireSession, useHistoireSnapshot } from '@histoire/vue'
import { defineAsyncComponent, ref } from 'vue'
import { usePresetConfigStore } from '../../../stores/presets-config.js'
import { getBackgroundPreset, getBackgroundPresetStyle } from '../../../util/background.js'
import { histoireConfig } from '../../../util/config.js'
import { backgroundPatch } from '../../canvas/toolbar/settings.js'
import SettingsCard from './SettingsCard.vue'
import SettingsRow from './SettingsRow.vue'

const SaveToProject = __HISTOIRE_DEV__ ? defineAsyncComponent(() => import('./SaveToProject.vue')) : undefined
const session = useHistoireSession()
const snapshot = useHistoireSnapshot()
const presets = usePresetConfigStore()!
const editing = ref<PresetOwner | 'new' | null>(null)
const draft = ref<BackgroundPreset>({ label: '', color: '#ffffff' })
const error = ref('')
/** Clicking swatches updates canonical story background immediately. */
async function select(value: string): Promise<void> {
  try {
    const patch = backgroundPatch(value)
    if (!patch) throw new Error('Background color is not supported')
    await session.settings.update(patch)
    error.value = ''
  }
  catch (reason) { error.value = reason instanceof Error ? reason.message : String(reason) }
}
/** Editor retains source/local owner while other rows are removed or reordered. */
function edit(index: number | null): void {
  const owner = index === null ? 'new' : presets.backgroundOwner(index)
  if (!owner) return
  editing.value = owner
  draft.value = index === null
    ? {
        label: '',
        color: '#ffffff',
      }
    : {
        ...presets.backgroundPresets.value[index],
      }
  error.value = ''
}
/** Persist only validated color data and labels. */
function save(): void {
  try {
    if (editing.value === 'new') presets.addBackground(draft.value)
    else if (editing.value) presets.updateBackground(editing.value, draft.value)
    editing.value = null
  }
  catch (reason) { error.value = reason instanceof Error ? reason.message : String(reason) }
}
</script>

<template>
  <SettingsCard>
    <header class="htw:flex htw:items-center htw:justify-between htw:gap-[10px] htw:p-[13px_20px] htw:[border-bottom:1px_solid_var(--histoire-border,_#e4e4e7)]">
      <strong>Story backgrounds</strong><HstButton color="default" class="htw:inline-flex htw:items-center htw:gap-[6px]" type="button" @click="edit(null)">
        + Add background
      </HstButton>
    </header>
    <div class="htw:flex htw:flex-wrap htw:gap-[10px] htw:p-[20px]">
      <div v-for="(preset, index) in presets.backgroundPresets.value" :key="presets.backgroundKey(index)" class="htw:w-[100px] htw:flex htw:flex-col htw:text-center htw:gap-[6px] htw:text-[12px]">
        <HstButton class="htw:w-full htw:h-[60px] htw:font-semibold htw:[&[aria-pressed=true]]:[outline:2px_solid_var(--histoire-accent,_#10b981)] htw:[&[aria-pressed=true]]:[outline-offset:2px]" color="flat" type="button" :style="getBackgroundPresetStyle(preset)" :aria-label="`Select ${preset.label} background`" :aria-pressed="getBackgroundPreset(snapshot.settings) === preset.color" @click="select(preset.color)">
          Aa
        </HstButton>
        <span>{{ preset.label }}</span><div class="htw:flex htw:justify-center htw:gap-[8px]">
          <HstButton class="htw:text-muted" color="flat" type="button" :aria-label="`Edit ${preset.label} background`" @click="edit(index)">
            Edit
          </HstButton><HstButton class="htw:text-muted" color="flat" type="button" :aria-label="`Remove ${preset.label} background`" @click="presets.removeBackground(index)">
            Remove
          </HstButton>
        </div>
      </div>
    </div>
    <SettingsRow v-if="editing !== null" as="form" @submit.prevent="save">
      <HstText v-model="draft.label" layout="inline" class="htw:min-w-0" aria-label="Background name" placeholder="Name" required />
      <HstText v-model="draft.color" layout="inline" class="htw:min-w-0" aria-label="Background color" placeholder="#ffffff" required />
      <HstText v-model="draft.contrastColor" layout="inline" class="htw:min-w-0" aria-label="Text contrast color" placeholder="Text color" />
      <HstButton color="default" type="submit">
        Save
      </HstButton><HstButton color="default" type="button" @click="editing = null">
        Cancel
      </HstButton>
    </SettingsRow>
    <SaveToProject v-if="SaveToProject" path="backgroundPresets" :value="presets.backgroundPresets.value" :project-value="histoireConfig.backgroundPresets" :local="presets.backgroundsOverridden.value" @reset="presets.resetBackgrounds" @saved="presets.resetBackgrounds" />
    <div v-else-if="presets.backgroundsOverridden.value" class="htw:flex htw:flex-wrap htw:items-center htw:gap-[8px] htw:p-[10px_20px] htw:text-[12px]">
      <HstButton color="default" type="button" @click="presets.resetBackgrounds">
        Reset to project
      </HstButton>
    </div>
    <span v-if="error" role="alert">{{ error }}</span>
  </SettingsCard>
</template>
