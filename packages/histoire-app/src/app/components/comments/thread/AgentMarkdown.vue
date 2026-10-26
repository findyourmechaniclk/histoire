<script setup lang="ts">
import { ref, watch } from 'vue'
import { renderAgentMarkdown } from './markdown.js'

const props = defineProps<{
  /** Agent markdown text. */
  text: string
  /** Text is still streaming; skip render caching. */
  streaming?: boolean
}>()
/** Last sanitized render; kept while a newer render is pending to avoid flicker. */
const html = ref('')
let generation = 0
watch(() => props.text, async (text) => {
  const current = ++generation
  try {
    const rendered = await renderAgentMarkdown(text, document, !props.streaming)
    if (current === generation) html.value = rendered
  }
  catch {
    if (current === generation) html.value = ''
  }
}, { immediate: true })
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitized by renderAgentMarkdown -->
  <div v-if="html" class="agent-markdown htw:text-[12px] htw:leading-[1.6] htw:text-body htw:wrap-anywhere htw:[&_:is(p,ul,ol,pre,blockquote,table)]:[margin:0_0_8px] htw:[&>:last-child]:mb-0 htw:[&_:is(ul,ol)]:pl-4.5 htw:[&_code]:[padding:1px_4px] htw:[&_code]:rounded-[4px] htw:[&_code]:bg-chip htw:[&_code]:text-[11px] htw:[&_pre]:p-2 htw:[&_pre]:rounded-[6px] htw:[&_pre]:bg-chip htw:[&_pre]:whitespace-pre-wrap htw:[&_pre]:wrap-anywhere htw:[&_pre_code]:p-0 htw:[&_pre_code]:[background:none] htw:[&_a]:text-accent-link htw:[&_:is(h1,h2,h3,h4)]:[margin:8px_0_4px] htw:[&_:is(h1,h2,h3,h4)]:text-[12px] htw:[&_blockquote]:pl-2 htw:[&_blockquote]:text-muted" v-html="html" />
  <p v-else class="agent-markdown plain htw:text-[12px] htw:leading-[1.6] htw:text-body htw:wrap-anywhere htw:m-0 htw:whitespace-pre-wrap">
    {{ text }}
  </p>
</template>
