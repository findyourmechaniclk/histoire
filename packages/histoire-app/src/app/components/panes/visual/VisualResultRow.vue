<script setup lang="ts">
import type { UiVisualResult } from '@histoire/shared'
import { BuiltinIcon, HstButton, HstPulsatingDisc } from '@histoire/controls/vue'
import { computed } from 'vue'
import { useWorkbenchVisual } from '../../../stores/visual.js'
import { visualStatus } from './status.js'

/** One case/profile comparison; label already omits story title shown by heading. */
const props = defineProps<{ result: UiVisualResult, label: string, approvable: boolean, selectable: boolean }>()
const model = useWorkbenchVisual()!
const status = computed(() => visualStatus(props.result))
/** Keep comparison status and diagnostic details available without crowding the row. */
const statusTitle = computed(() => model.approvalPending(props.result) ? 'Saving baseline' : [props.result.staleReason ? 'Stale' : status.value.label, props.result.staleReason ?? props.result.error ?? props.result.warning].filter(Boolean).join(': '))
const checked = computed(() => model.selectedIds.value.includes(props.result.id))

/** Independent toggles never imply approve-all. */
function toggle(): void {
  model.selectedIds.value = checked.value ? model.selectedIds.value.filter(value => value !== props.result.id) : [...model.selectedIds.value, props.result.id]
}
</script>

<template>
  <div class="htw:group/visual-row htw:flex htw:items-center htw:gap-1 htw:h-[var(--histoire-virtual-row-height,_39px)] htw:py-0 htw:px-1 htw:rounded-[6px] htw:hover:bg-accent-soft htw:aria-[current=true]:bg-accent-soft" :data-tone="status.tone" :aria-current="model.selectedResultId.value === result.id ? 'true' : undefined">
    <span v-if="selectable" class="htw:grid htw:place-items-center htw:flex-none htw:w-5">
      <input v-if="approvable" class="htw:m-0 htw:accent-accent htw:cursor-pointer" type="checkbox" :disabled="model.approvalPending(result)" :aria-label="`Select ${result.case.label} ${result.spec.id} for approval`" :checked="checked" @change="toggle">
    </span>
    <button class="htw:flex htw:items-center htw:gap-2 htw:flex-1 htw:min-w-0 htw:h-full htw:py-0 htw:px-1 htw:bg-transparent htw:border-0 htw:text-text htw:[font-family:inherit] htw:[font-size:inherit] htw:[font-weight:inherit] htw:leading-4.5 htw:text-start htw:cursor-pointer htw:focus-visible:[outline:2px_solid_var(--histoire-accent)] htw:focus-visible:outline-offset-[-2px] htw:focus-visible:rounded-[6px]" type="button" :aria-label="`Review ${result.case.label} ${result.spec.id}, ${model.approvalPending(result) ? 'Saving baseline' : result.staleReason ? 'Stale' : status.label}`" :title="statusTitle" @click="model.review(result)">
      <HstPulsatingDisc v-if="model.busy(result) || model.approvalPending(result)" :size="12" />
      <BuiltinIcon v-else class="htw:flex-none htw:text-muted htw:group-data-[tone=passed]/visual-row:text-accent htw:group-data-[tone=danger]/visual-row:text-danger htw:group-data-[tone=warn]/visual-row:text-warn" :icon="status.icon" :size="16" />
      <span class="htw:flex htw:flex-col htw:flex-1 htw:min-w-0 htw:overflow-hidden">
        <span class="htw:overflow-hidden htw:whitespace-nowrap htw:text-ellipsis" :title="label">{{ label }}</span>
        <span class="htw:min-w-0 htw:overflow-hidden htw:whitespace-nowrap htw:text-ellipsis htw:text-muted htw:font-mono htw:text-[11px] htw:leading-3.5" :title="result.spec.id">{{ result.spec.id }}</span>
      </span>
    </button>
    <HstButton color="flat" icon-only type="button" class="htw:flex-none htw:opacity-0 htw:group-hover/visual-row:opacity-100 htw:focus-visible:opacity-100" :disabled="!!model.requestId.value || model.approvalPending(result)" :aria-label="`Run again ${result.case.label} ${result.spec.id}`" title="Run again" @click="model.rerun(result)">
      <BuiltinIcon icon="renew" :size="14" />
    </HstButton>
    <HstButton v-if="result.case.kind === 'matrix'" color="flat" icon-only type="button" class="htw:flex-none htw:opacity-0 htw:group-hover/visual-row:opacity-100 htw:focus-visible:opacity-100" :aria-label="`Remove saved case ${result.case.label}`" title="Remove saved case" @click="model.remove(result.case)">
      <BuiltinIcon icon="trash-can" :size="14" />
    </HstButton>
  </div>
</template>
