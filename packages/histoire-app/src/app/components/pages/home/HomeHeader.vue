<script setup lang="ts">
import type { HistoireBuildInfo } from '@histoire/shared'
import { computed } from 'vue'

const props = defineProps<{
  /** Project theme title. */
  title: string
  /** Optional project description. */
  description?: string
  /** Real project release/build metadata. */
  buildInfo?: HistoireBuildInfo
}>()
const buildLine = computed(() => [props.buildInfo?.version && `v${props.buildInfo.version}`, props.buildInfo?.branch, props.buildInfo?.commit?.slice(0, 7)].filter(Boolean).join(' · '))
</script>

<template>
  <header>
    <h1 class="htw:m-0 htw:text-[clamp(28px,_4vw,_36px)] htw:font-extrabold htw:[letter-spacing:-.02em]">
      {{ title }}
    </h1>
    <p v-if="description" class="htw:m-[12px_0_8px] htw:text-body htw:text-[15px]">
      {{ description }}
    </p>
    <p v-if="buildInfo" class="htw:text-muted htw:font-mono htw:text-[11px] htw:m-[12px_0_0]">
      <template v-if="buildLine">
        {{ buildLine }} ·
      </template><time class="htw:text-muted htw:font-mono htw:text-[11px] htw:inline" :datetime="buildInfo.builtAt">{{ new Date(buildInfo.builtAt).toLocaleDateString() }}</time>
    </p>
  </header>
</template>
