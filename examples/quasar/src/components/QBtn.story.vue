<script setup>
import { ref } from 'vue'

const label = ref('Click me')
</script>

<template>
  <Story title="QBtn">
    <q-btn
      color="primary"
      :label="label"
    />

    <template #controls>
      <HstText
        v-model="label"
        title="Label"
      />
    </template>
  </Story>
</template>
