<script setup lang="ts">
import DevframeCounter from './DevframeCounter.vue'
/** Initial state is kept by the mounted story and can be read through MCP. */
function initialState() {
  return { count: 0 }
}

/** Second variant has distinct state for testing frame selection. */
function secondState() {
  return { count: 10 }
}
</script>

<template>
  <Story id="devframe-example" title="Devframe example">
    <Variant id="counter" title="Counter" :init-state="initialState">
      <template #default="{ state }">
        <DevframeCounter label="First counter" :count="state.count" @increment="state.count++" />
      </template>
    </Variant>
    <Variant id="second" title="Second counter" :init-state="secondState">
      <template #default="{ state }">
        <DevframeCounter label="Second counter" :count="state.count" @increment="state.count++" />
      </template>
    </Variant>
  </Story>
</template>
