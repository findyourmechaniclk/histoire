<script lang="ts" setup>
import HstSimpleCheckbox from './HstSimpleCheckbox.vue'

function initState() {
  return {
    checked: true,
  }
}
</script>

<template>
  <Story
    title="internals/HstSimpleCheckbox"
    :layout="{ type: 'single' }"
  >
    <Variant
      title="playground"
      :init-state="initState"
    >
      <template #default="{ state }">
        <HstSimpleCheckbox
          :model-value="state.checked"
          @click="state.checked = !state.checked"
        />
      </template>
    </Variant>
  </Story>
</template>
