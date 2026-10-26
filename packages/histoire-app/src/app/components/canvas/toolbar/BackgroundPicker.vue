<script setup lang="ts">
import { HstButton, HstButtonGroup, HstText } from '@histoire/controls/vue'
import { PREVIEW_SETTINGS_SYNC } from '@histoire/shared'
import { computed, ref, useId } from 'vue'
import { useCanvasFrames, useCanvasStore } from '../../../composables/canvas-settings.js'
import { usePresetConfigStore } from '../../../stores/presets-config.js'
import { getBackgroundPreset, getBackgroundPresetStyle, withCheckerboardPresets } from '../../../util/background.js'
import { histoireConfig } from '../../../util/config.js'
import { useToolbarPresentation } from '../../base/overflow/presentation.js'
import PopoverDivider from '../../base/popover/PopoverDivider.vue'
import PopoverError from '../../base/popover/PopoverError.vue'
import PopoverTitle from '../../base/popover/PopoverTitle.vue'
import { useCanvasPreviewSettings } from './session-settings.js'
import { backgroundPatch } from './settings.js'
import ToolbarPopover from './ToolbarPopover.vue'

defineProps<{ open: string | null }>()
const emit = defineEmits<{ 'update:open': [value: string | null] }>()
const canvas = useCanvasStore()
const frames = useCanvasFrames()
const { snapshot, update } = useCanvasPreviewSettings()
const presetsOwner = usePresetConfigStore()
const presets = computed(() => withCheckerboardPresets(presetsOwner?.backgroundPresets.value ?? histoireConfig.backgroundPresets ?? []))
const scope = ref<'all' | 'selected'>('all')
const customHex = ref('#FEF3C7')
const customId = useId()
const error = ref('')
const selected = computed(() => canvas.selectedFrame ? canvas.frameBackgrounds[canvas.selectedFrame] : undefined)
const background = computed(() => scope.value === 'selected' && selected.value ? selected.value : snapshot.value.settings)
const activePreset = computed(() => getBackgroundPreset(background.value))

/** Shared backgrounds use canonical session; frame-only override remains canvas-owned. */
function apply(color: string, custom = false) {
  const patch = backgroundPatch(color, false, custom)
  error.value = patch ? '' : 'Enter a hex color, such as #FEF3C7.'
  if (!patch) return
  if (scope.value === 'selected' && canvas.selectedFrame) {
    canvas.setFrameBackground(canvas.selectedFrame, patch.backgroundColor!, patch.checkerboard, patch.checkerboardTheme)
    frames.postToFrame(canvas.selectedFrame, { type: PREVIEW_SETTINGS_SYNC, settings: { ...snapshot.value.settings, ...patch } })
  }
  else {
    canvas.setBackground(patch.backgroundColor!)
    for (const id of Object.keys(canvas.frameBackgrounds)) delete canvas.frameBackgrounds[id]
    update(patch)
  }
}

const presentation = useToolbarPresentation()
</script>

<template>
  <ToolbarPopover id="background" :open="open" label="Background" icon="color-palette" icon-only :width="280" data-test-id="toolbar-background" @update:open="emit('update:open', $event)">
    <template #trigger>
      <span :data-presentation="presentation" class="htw:data-[presentation=menu]:inline-flex htw:hidden htw:w-[14px] htw:h-[14px] htw:border htw:border-solid htw:border-border htw:rounded-[3px]" :style="getBackgroundPresetStyle({ color: activePreset, label: '' })" />
    </template>
    <div data-test-id="background-popper">
      <PopoverTitle>
        Background
      </PopoverTitle>
      <div class="htw:grid htw:grid-cols-6 htw:gap-1.5 htw:p-[0_8px_7px]">
        <HstButton v-for="(option, index) in presets" :key="index" color="flat" type="button" class="htw:min-w-0 htw:h-[42px] htw:p-0 htw:border htw:border-solid htw:border-border htw:rounded-[9px] htw:cursor-pointer htw:[font-family:inherit] htw:text-text htw:aria-pressed:outline-2 htw:aria-pressed:outline-solid htw:aria-pressed:outline-accent htw:aria-pressed:outline-offset-2" :style="getBackgroundPresetStyle(option)" :aria-label="option.label" :title="option.label" :aria-pressed="activePreset === option.color" @click="apply(option.color)">
          Aa
        </HstButton>
      </div>
      <form class="htw:flex htw:items-center htw:gap-2 htw:py-[7px] htw:px-2" @submit.prevent="apply(customHex, true)">
        <span class="htw:w-5 htw:h-5 htw:rounded-[5px] htw:border htw:border-solid htw:border-border" :style="{ backgroundColor: /^#[\da-f]{3,8}$/i.test(customHex) ? customHex : undefined }" /><label :for="customId">Custom</label><HstText :id="customId" v-model="customHex" class="htw:w-[100px] htw:ml-auto" layout="inline" aria-label="Custom hex color" maxlength="9" @change="apply(customHex, true)" /><HstButton color="flat" class="htw:absolute htw:w-px htw:h-px htw:overflow-hidden htw:[clip-path:inset(50%)]" type="submit">
          Apply custom background
        </HstButton>
      </form>
      <PopoverError v-if="error" role="alert">
        {{ error }}
      </PopoverError>
      <PopoverDivider />
      <HstButtonGroup v-model="scope" title="Apply to" layout="horizontal" aria-label="Apply background to" :options="[{ value: 'all', label: 'All frames' }, { value: 'selected', label: 'Selected', disabled: !canvas.selectedFrame }]" />
    </div>
  </ToolbarPopover>
</template>
