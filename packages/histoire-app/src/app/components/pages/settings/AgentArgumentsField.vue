<script setup lang="ts">
import { BuiltinIcon, HstButton, HstText } from '@histoire/controls/vue'
import { nextTick, ref } from 'vue'

/** Prefix for accessible field names, usually the agent name. */
const props = defineProps<{ label: string }>()
/** One entry per process argument, preserving exact boundaries without quoting rules. */
const args = defineModel<string[]>({ required: true })
/** Argument rows used to focus a newly added field. */
const list = ref<HTMLElement>()

/** Appends an empty argument and focuses it for immediate typing. */
async function add(): Promise<void> {
  args.value = [...args.value, '']
  await nextTick()
  list.value?.querySelector<HTMLInputElement>('.histoire-agent-arg:last-child input')?.focus()
}

/**
 * Removes one argument by position.
 * @param index Argument position.
 */
function remove(index: number): void {
  args.value = args.value.filter((_, item) => item !== index)
}

/**
 * Replaces one argument by position.
 * @param index Argument position.
 * @param value New argument text.
 */
function update(index: number, value: string): void {
  args.value = args.value.map((item, position) => position === index ? value : item)
}
</script>

<template>
  <div ref="list" class="htw:min-w-0 htw:flex htw:flex-col htw:gap-[6px]">
    <div v-for="(arg, index) in args" :key="index" class="histoire-agent-arg htw:grid htw:[grid-template-columns:minmax(0,_1fr)_auto] htw:gap-[6px]">
      <HstText :model-value="arg" layout="inline" class="htw:min-w-0" :aria-label="`${props.label} argument ${index + 1}`" spellcheck="false" autocomplete="off" @update:model-value="update(index, $event)" />
      <HstButton icon-only color="default" type="button" :aria-label="`Remove argument ${index + 1}`" @click="remove(index)">
        <BuiltinIcon icon="close" :size="14" />
      </HstButton>
    </div>
    <HstButton color="flat" type="button" class="htw:self-start htw:inline-flex htw:items-center htw:gap-[6px]" :disabled="args.length >= 64" @click="add">
      <BuiltinIcon icon="add" :size="14" />Add argument
    </HstButton>
  </div>
</template>
