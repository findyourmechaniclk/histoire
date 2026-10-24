<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<script lang="ts" setup>
import type { Story } from '../../types'
import { clientSupportPlugins } from 'virtual:$histoire-support-plugins-client'
import { computed, markRaw, ref, watchEffect } from 'vue'
import { resolveStoryFileComponent } from '../../util/story-component'

const props = defineProps<{
  story: Story
  /**
   * No hidden mount configures the story (see `GenericMountStory` `optional`):
   * the support plugin's `RenderStory` does it, when it supports it.
   */
  configureStory?: boolean
}>()

const mountComponent = ref(null)
const supportsConfigure = ref(false)
/** Only passed to plugins declaring support, other `RenderStory` would get a stray attribute. */
const configureProps = computed(() => props.configureStory && supportsConfigure.value ? { configureStory: true } : {})

watchEffect(async () => {
  const clientPlugin = clientSupportPlugins[props.story.file?.supportPluginId]
  if (clientPlugin) {
    try {
      const pluginModule = await clientPlugin()
      supportsConfigure.value = !!pluginModule.renderConfiguresStory
      if (props.configureStory && supportsConfigure.value) {
        // Normally resolved by the hidden mount, skipped in that case.
        await resolveStoryFileComponent(props.story.file)
      }
      mountComponent.value = markRaw(pluginModule.RenderStory)
    }
    catch (e) {
      console.error(e)
      throw e
    }
  }
})
</script>

<template>
  <component
    :is="mountComponent"
    v-if="mountComponent"
    class="histoire-generic-render-story __histoire-render-story"
    :story="story"
    v-bind="{ ...$attrs, ...configureProps }"
  />
</template>
