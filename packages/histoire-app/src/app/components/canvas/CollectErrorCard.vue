<script setup lang="ts">
import type { HistoireDiagnostic } from '@histoire/sdk'
import { BuiltinIcon } from '@histoire/controls/vue'

defineProps<{
  /** Completed collection diagnostics for current story. */
  errors: readonly HistoireDiagnostic[]
}>()
</script>

<template>
  <section class="htw:absolute htw:left-9 htw:bottom-[54px] htw:flex htw:items-start htw:gap-3 htw:max-w-[min(560px,_calc(100%_-_72px))] htw:max-h-[35%] htw:overflow-auto htw:p-4 htw:border htw:border-solid htw:border-danger htw:rounded-[12px] htw:bg-danger-soft htw:text-danger htw:text-[13px]" role="alert">
    <BuiltinIcon icon="error-filled" :size="18" />
    <div>
      <strong class="htw:block htw:mb-2">Story collection failed</strong><div v-for="(error, index) in errors" :key="index">
        <code v-if="error.relativePath" class="htw:font-mono htw:text-[11px]">{{ error.relativePath }}</code><p class="htw:m-[6px_0_0] htw:whitespace-pre-wrap htw:[overflow-wrap:anywhere]">
          {{ error.message }}
        </p>
      </div>
    </div>
  </section>
</template>
