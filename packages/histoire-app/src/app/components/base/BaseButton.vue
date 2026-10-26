<script setup lang="ts">
import { HstButton } from '@histoire/controls/vue'
import { RouterLink } from 'vue-router'

defineOptions({ inheritAttrs: false })
defineProps<{
  /** Existing router destination. */
  to?: any
  /** Existing native link destination. */
  href?: string
}>()
</script>

<template>
  <RouterLink v-if="to" v-slot="{ href: destination, navigate }" :to="to" custom>
    <HstButton v-bind="$attrs" as="a" :href="destination" color="primary" class="histoire-base-button" @click="navigate">
      <slot />
    </HstButton>
  </RouterLink>
  <HstButton v-else v-bind="$attrs" :as="href ? 'a' : 'button'" :href="href" color="primary" class="histoire-base-button">
    <slot />
  </HstButton>
</template>
