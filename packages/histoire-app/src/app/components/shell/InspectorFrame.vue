<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { useShell } from '../../composables/shell.js'
import PanelResizeHandle from './PanelResizeHandle.vue'

defineProps<{
  /** Inspector region controlled by its resize separator. */
  id: string
  /** Accessible inspector region name, independent of selected content. */
  label?: string
}>()
const emit = defineEmits<{ close: [] }>()
const shell = useShell()
</script>

<template>
  <aside :id="id" class="histoire-inspector-frame htw:flex htw:flex-col htw:absolute htw:inset-y-3 htw:end-3 htw:w-[344px] htw:max-w-[calc(100%-24px)] htw:z-30 htw:rounded-[16px] htw:bg-surface htw:shadow-panel htw:[@container(max-width:640px)]:top-16" :aria-label="label ?? 'Story inspector'" :style="{ width: `${shell.inspectorWidth.value}px` }">
    <PanelResizeHandle :controls="id" label="Resize inspector" edge="start" :model-value="shell.inspectorWidth.value" :min="shell.inspectorWidthBounds.value.min" :max="shell.inspectorWidthBounds.value.max" @update:model-value="shell.setInspectorWidth" />
    <div class="htw:flex htw:flex-col htw:flex-1 htw:min-h-0 htw:rounded-[inherit] htw:overflow-hidden">
      <header v-if="$slots.header" class="htw:flex htw:items-center htw:justify-between htw:gap-3 htw:p-4">
        <slot name="header" />
        <HstButton class="htw:[--histoire-icon-button-size:28px]" icon-only color="flat" type="button" aria-label="Close inspector" @click="emit('close')">
          <BuiltinIcon icon="close" :size="18" />
        </HstButton>
      </header>
      <div class="htw:flex htw:flex-col htw:flex-1 htw:min-h-0 htw:overflow-auto">
        <slot />
      </div>
    </div>
  </aside>
</template>
