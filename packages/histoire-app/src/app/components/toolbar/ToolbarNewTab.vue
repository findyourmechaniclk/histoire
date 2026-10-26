<script lang="ts" setup>
import type { Story, Variant } from '../../types'
import { BuiltinIcon } from '@histoire/controls/vue'
import { computed } from 'vue'
import { getSandboxUrl } from '../../util/sandbox'

const props = defineProps<{
  variant: Variant
  story: Story
}>()

const sandboxUrl = computed(() => {
  return getSandboxUrl(props.story, props.variant)
})
</script>

<template>
  <a
    v-tooltip="'Open variant in new tab'"
    :href="sandboxUrl"
    target="_blank"
    aria-label="Open variant in new tab"
    class="histoire-icon-button htw:hover:text-primary-500 htw:opacity-50 htw:hover:opacity-100 htw:dark:hover:text-primary-400 htw:text-gray-900 htw:dark:text-gray-100"
  >
    <BuiltinIcon
      icon="carbon:launch"
      class="htw:w-4 htw:h-4"
    />
  </a>
</template>
