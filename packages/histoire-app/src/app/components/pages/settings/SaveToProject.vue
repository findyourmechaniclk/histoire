<script setup lang="ts">
import { HstButton } from '@histoire/controls/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useProjectConfigStore } from '../../../stores/project-config.js'
import { createConfigSnippet, previewConfigValueDiff } from './project-config-preview.js'
import ProjectSourceBadge from './ProjectSourceBadge.vue'

const props = defineProps<{ path: string, value: unknown, projectValue?: unknown, local?: boolean }>()
const emit = defineEmits<{ reset: [], saved: [] }>()
const project = useProjectConfigStore()
const confirm = ref(false)
const copied = ref(false)
const status = computed(() => project?.state.value.paths[props.path])
const editable = computed(() => ['absent', 'editable'].includes(status.value?.status ?? ''))
const snippet = computed(() => createConfigSnippet(props.path, props.value))
const diff = computed(() => previewConfigValueDiff(props.path, props.projectValue, props.value))
/** Exact confirmed value survives replacement; later user edits keep their override. */
function consumeSaved(): void {
  confirm.value = false
  if (project?.consumeSaved(props.path, props.value)) emit('saved')
}
onBeforeUnmount(project?.onSaved(consumeSaved) ?? (() => {}))
watch(() => props.path, (path) => {
  consumeSaved()
  project?.read([path])
}, { immediate: true })
/** Clipboard failure remains visible and does not discard the manual snippet. */
async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(snippet.value)
    copied.value = true
  }
  catch { copied.value = false }
}
/** Only explicit confirmation admits a filesystem write. */
function save(): void {
  project?.save([{
    path: props.path,
    value: props.value,
  }])
}
</script>

<template>
  <div v-if="project?.available" class="htw:flex htw:flex-wrap htw:items-center htw:gap-[8px] htw:p-[10px_20px] htw:text-[12px]">
    <ProjectSourceBadge :path="path" :local="local" />
    <HstButton color="default" type="button" :disabled="!local || !editable || project.pending.value" @click="confirm = !confirm">
      Save to project
    </HstButton>
    <HstButton color="default" type="button" :disabled="!local" @click="emit('reset')">
      Reset to project
    </HstButton>
    <template v-if="!editable && status">
      <span class="htw:text-muted htw:text-[12px]">{{ status.reason }}</span>
      <HstButton color="default" type="button" @click="copy">
        {{ copied ? 'Copied' : 'Copy snippet' }}
      </HstButton>
      <pre class="htw:[flex:1_0_100%] htw:overflow-auto htw:whitespace-pre-wrap htw:max-h-[200px] htw:font-mono htw:text-[11px]">{{ snippet }}</pre>
    </template>
    <template v-if="confirm">
      <pre class="htw:[flex:1_0_100%] htw:overflow-auto htw:whitespace-pre-wrap htw:max-h-[200px] htw:font-mono htw:text-[11px]" aria-label="Project settings diff">{{ diff }}</pre>
      <HstButton color="default" type="button" :disabled="project.pending.value" @click="save">
        Confirm save
      </HstButton>
      <HstButton color="default" type="button" @click="confirm = false">
        Cancel
      </HstButton>
    </template>
    <span v-if="project.state.value.error" role="alert">{{ project.state.value.error }}</span>
  </div>
</template>
