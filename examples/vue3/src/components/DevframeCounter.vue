<script setup lang="ts">
/** Counter identity and current value shown by Vue DevTools. */
defineProps<{ label: string, count: number }>()
/** Notify the story when its counter changes. */
defineEmits<{ increment: [] }>()
</script>

<template>
  <button type="button" @click="$emit('increment')">
    Count {{ count }}
  </button>
</template>
