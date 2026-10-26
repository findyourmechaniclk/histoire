<script setup lang="ts">
defineProps<{
  /** Short headline explaining the current state. */
  title: string
  /** Grow within a flex panel, allowing long details to scroll. */
  fill?: boolean
  /** Leave outer spacing to the parent layout. */
  flush?: boolean
  /** Empty/loading states announce status; failures announce alerts. */
  role: 'status' | 'alert'
  /** Announce the entire state when its content changes. */
  atomic?: boolean
}>()
defineSlots<{
  /** State-specific icon or loading indicator. */
  visual: () => any
  /** Optional detail beneath the headline. */
  default?: () => any
  /** Optional recovery or follow-up actions. */
  actions?: () => any
}>()
</script>

<template>
  <!-- Callers owning outer layout opt out of the default pane margins. -->
  <div class="workbench-state htw:flex htw:flex-col htw:items-center htw:gap-1.5 htw:text-center htw:text-muted htw:text-[12px]" :class="{ 'htw:flex-1 htw:min-w-0 htw:overflow-auto': fill, 'htw:my-12 htw:mx-pane-gutter': !flush }" :role="role" :aria-atomic="atomic || undefined">
    <slot name="visual" />
    <strong class="htw:text-text htw:text-[14px] htw:font-semibold">{{ title }}</strong>
    <p v-if="$slots.default" class="htw:max-w-full htw:m-0 htw:[overflow-wrap:anywhere]">
      <slot />
    </p>
    <div v-if="$slots.actions" class="htw:flex htw:flex-wrap htw:justify-center htw:gap-2 htw:mt-2">
      <slot name="actions" />
    </div>
  </div>
</template>
