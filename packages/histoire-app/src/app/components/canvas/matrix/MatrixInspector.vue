<script setup lang="ts">
import { BuiltinIcon, HstButton, HstSelect } from '@histoire/controls/vue'
import { useHistoireContext, useHistoireResource } from '@histoire/vue/internal'
import { computed, ref, useId, watch } from 'vue'
import { useSelection } from '../../../composables/selection.js'
import { useMatrixStore } from '../../../stores/matrix.js'
import { formatMatrixValue } from '../../../util/matrix-values.js'
import { matrixVariantSnippet } from '../../../util/matrix.js'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'
import MatrixAxisEntry from './MatrixAxisEntry.vue'
import MatrixBaseProp from './MatrixBaseProp.vue'
import MatrixCustomAxes from './MatrixCustomAxes.vue'
import MatrixVisualActions from './MatrixVisualActions.vue'

const emit = defineEmits<{ error: [error: unknown] }>()
const matrix = useMatrixStore()
const context = useHistoireContext()
const { session, story, variant } = useSelection()
const copying = ref(false)
const copied = ref(false)
/** Connect toolbar label to the inline preset select. */
const presetId = `histoire-matrix-preset-${useId()}`
const fields = computed(() => matrix.props.value.filter(prop => prop.name !== matrix.rows.value && prop.name !== matrix.cols.value))
const dimensions = computed(() => ([{ id: 'rows' as const, axis: matrix.rowAxis.value }, { id: 'cols' as const, axis: matrix.colAxis.value }]).filter(dimension => dimension.axis))
let active = true
useHistoireResource(() => {
  active = false
})
watch(() => matrix.selectedCell.value, () => copied.value = false)

/** Changing base preset reuses exact canonical selection and its source generator. */
function preset(id: string): void {
  if (!story.value) return
  void session.selection.select({ storyId: story.value.id, variantId: id }).catch(error => active && emit('error', error))
}

/** Reset base editing without touching canonical controls or selected variant. */
function reset(): void {
  matrix.resetBase(Object.fromEntries(fields.value.map(prop => [prop.name, prop.value])))
}

/** Framework-generated cell source is copied only while original cell still owns it. */
async function copyVariant(): Promise<void> {
  const cell = matrix.selectedCell.value
  if (!cell || copying.value) return
  copying.value = true
  try {
    const source = await matrix.sourceForSelected()
    if (!active || matrix.selectedCell.value?.props !== cell.props) return
    const clipboard = context.root.value?.ownerDocument.defaultView?.navigator.clipboard
    if (!clipboard) throw new Error('Clipboard unavailable')
    const tag = story.value?.supportPluginId?.includes('svelte') ? 'Hst.Variant' : 'Variant'
    await clipboard.writeText(matrixVariantSnippet(`${formatMatrixValue(cell.row)} · ${formatMatrixValue(cell.col)}`, source, tag))
    if (active && matrix.selectedCell.value?.props === cell.props) copied.value = true
  }
  catch (error) { if (active && matrix.selectedCell.value?.props === cell.props) emit('error', error) }
  finally { if (active) copying.value = false }
}
</script>

<template>
  <div class="htw:px-inspector-gutter htw:pt-0 htw:pb-4">
    <div class="htw:flex htw:items-center htw:gap-2 htw:min-w-0 htw:m-[2px_0_20px]">
      <label :for="presetId" class="htw:inline-flex htw:items-center htw:gap-2 htw:flex-none htw:text-muted htw:text-[12px] htw:whitespace-nowrap">
        <BuiltinIcon icon="bookmark" :size="16" />
        <span>Base preset</span>
      </label>
      <HstSelect
        :id="presetId"
        class="htw:flex-1 htw:min-w-0"
        title="Base preset"
        layout="inline"
        :model-value="variant?.id ?? story?.variants[0]?.id"
        :options="(story?.variants ?? []).map(item => ({ value: item.id, label: item.title }))"
        @update:model-value="preset"
      />
      <HstButton class="htw:text-muted" icon-only color="flat" type="button" aria-label="Reset matrix base props" title="Reset matrix base props" @click="reset">
        <BuiltinIcon icon="reset" :size="16" />
      </HstButton>
    </div>
    <div class="htw:flex htw:flex-col htw:gap-2.5 htw:min-w-0 htw:p-3 htw:border htw:border-solid htw:border-border htw:rounded-panel htw:bg-transparent htw:text-[11px] htw:text-muted">
      <span>Selected cell</span>
      <dl v-if="matrix.selectedCell.value" class="htw:flex htw:flex-col htw:gap-2 htw:m-0 htw:text-text">
        <div class="htw:grid htw:grid-cols-2 htw:gap-3">
          <dt class="htw:min-w-0 htw:m-0 htw:[overflow-wrap:anywhere]">
            <code class="htw:font-mono">{{ matrix.rowAxis.value!.name }}</code>
          </dt>
          <dd class="htw:min-w-0 htw:m-0 htw:[overflow-wrap:anywhere] htw:text-right">
            {{ formatMatrixValue(matrix.selectedCell.value.row) }}
          </dd>
        </div>
        <div class="htw:grid htw:grid-cols-2 htw:gap-3">
          <dt class="htw:min-w-0 htw:m-0 htw:[overflow-wrap:anywhere]">
            <code class="htw:font-mono">{{ matrix.colAxis.value!.name }}</code>
          </dt>
          <dd class="htw:min-w-0 htw:m-0 htw:[overflow-wrap:anywhere] htw:text-right">
            {{ formatMatrixValue(matrix.selectedCell.value.col) }}
          </dd>
        </div>
      </dl>
      <WorkbenchEmptyState v-else flush class="htw:my-2 htw:mx-0" icon="grid" title="No cell selected" />
      <HstButton class="htw:w-full htw:whitespace-nowrap" color="flat" type="button" :disabled="!matrix.canCopy.value || copying" @click="copyVariant">
        {{ copied ? 'Copied' : copying ? 'Copying…' : 'Save as variant' }}
      </HstButton>
    </div>
    <MatrixVisualActions scope="selected" />
    <section aria-label="Matrix axes">
      <h3 class="htw:mt-[22px] htw:mb-[14px] htw:mx-0 htw:text-muted htw:text-[10px] htw:font-extrabold htw:uppercase">
        Axes
      </h3>
      <MatrixAxisEntry v-for="dimension in dimensions" :key="dimension.id" :name="dimension.axis!.name" :dimension="dimension.id" />
      <MatrixCustomAxes />
    </section>
    <section aria-label="Matrix base props">
      <div class="htw:flex htw:items-baseline htw:justify-between">
        <h3 class="htw:mt-[22px] htw:mb-[14px] htw:mx-0 htw:text-muted htw:text-[10px] htw:font-extrabold htw:uppercase">
          Base props
        </h3><span class="htw:text-muted htw:text-[10px]">all {{ matrix.cells.value.length }} cells</span>
      </div>
      <MatrixBaseProp v-for="prop in fields" :key="prop.name" :prop="prop" :value="Object.hasOwn(matrix.base.value, prop.name) ? matrix.base.value[prop.name] : prop.value" :values="matrix.axes.value.find(axis => axis.name === prop.name)?.values" :edited="Object.hasOwn(matrix.base.value, prop.name) && !Object.is(matrix.base.value[prop.name], prop.value)" @update="matrix.setBase(prop.name, $event)" />
    </section>
    <output v-if="copied" class="htw:block htw:mt-2 htw:text-accent-link htw:text-[11px]" aria-live="polite">Variant snippet copied</output>
  </div>
</template>
