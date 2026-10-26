<script setup lang="ts">
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'

defineProps<{
  /** File name; image tiles show it as a tooltip only. */
  name: string
  /** Thumbnail URL; makes this an image tile that opens the viewer. */
  src?: string
  /** Type and size line of a file card. */
  meta?: string
  /** Download link of a file card. */
  href?: string
  /** Shows a remove button. */
  removable?: boolean
}>()
const emit = defineEmits<{
  /** Open the image viewer. */
  open: []
  /** Detach the file from the message. */
  remove: []
}>()
</script>

<template>
  <div class="htw:relative htw:inline-flex htw:items-center htw:gap-2 htw:h-12 htw:max-w-55 htw:pt-0 htw:pr-7 htw:pb-0 htw:pl-1.5 htw:border htw:border-border htw:rounded-control htw:bg-chip htw:text-[12px] htw:group/attachment htw:data-[image=true]:w-12 htw:data-[image=true]:p-0 htw:data-[image=true]:overflow-hidden" :data-image="Boolean(src)" :title="name">
    <button v-if="src" type="button" class="htw:block htw:w-full htw:h-full htw:p-0 htw:border-0 htw:bg-surface htw:cursor-zoom-in htw:focus-visible:[outline:2px_solid_var(--histoire-agent)] htw:focus-visible:-outline-offset-2" :aria-label="`Open ${name}`" @click="emit('open')">
      <img :src="src" alt="" class="htw:block htw:w-full htw:h-full htw:object-cover">
    </button>
    <template v-else>
      <span class="htw:grid htw:flex-none htw:place-items-center htw:w-8.5 htw:h-8.5 htw:rounded-control htw:bg-surface htw:text-muted"><BuiltinIcon icon="document" :size="16" /></span>
      <span class="htw:flex htw:flex-col htw:min-w-0 htw:leading-[1.3]">
        <a v-if="href" class="htw:overflow-hidden htw:text-inherit htw:font-semibold htw:no-underline htw:text-ellipsis htw:whitespace-nowrap htw:hover:underline" :href="href" :download="name">{{ name }}</a>
        <span v-else class="htw:overflow-hidden htw:text-inherit htw:font-semibold htw:no-underline htw:text-ellipsis htw:whitespace-nowrap">{{ name }}</span>
        <span v-if="meta" class="htw:text-muted htw:text-[11px]">{{ meta }}</span>
      </span>
    </template>
    <HstButton v-if="removable" icon-only color="flat" type="button" class="htw:[--histoire-icon-button-size:18px] htw:absolute htw:top-0.75 htw:right-0.75 htw:rounded-full htw:text-muted htw:[box-shadow:0_0_0_1px_var(--histoire-border)] htw:bg-surface htw:hover:bg-chip htw:group-data-[image=true]/attachment:opacity-0 htw:group-data-[image=true]/attachment:bg-black/70 htw:group-data-[image=true]/attachment:text-white htw:group-data-[image=true]/attachment:shadow-[0_0_0_1px_rgb(255_255_255/0.25)] htw:group-data-[image=true]/attachment:[transition:opacity_120ms_ease,background-color_120ms_ease] htw:group-data-[image=true]/attachment:hover:bg-black/90 htw:group-hover/attachment:opacity-100 htw:group-focus-within/attachment:opacity-100" :aria-label="`Remove ${name}`" :title="`Remove ${name}`" @click="emit('remove')">
      <BuiltinIcon icon="close" :size="12" />
    </HstButton>
  </div>
</template>
