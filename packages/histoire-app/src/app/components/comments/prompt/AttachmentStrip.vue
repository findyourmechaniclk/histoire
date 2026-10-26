<script setup lang="ts">
import type { UiCommentAttachment } from '@histoire/shared'
import { HstPulsatingDisc } from '@histoire/controls/vue'
import { shallowRef } from 'vue'
import { attachmentUrl } from '../../../util/comments-http.js'
import { screenshotUrl } from '../../../util/screenshot-file.js'
import { attachmentMeta, isImage } from './attachment-meta.js'
import AttachmentTile from './AttachmentTile.vue'
import AttachmentViewer from './AttachmentViewer.vue'

withDefaults(defineProps<{
  /** Stored uploads. */
  attachments: readonly UiCommentAttachment[]
  /** Canvas screenshot captured for a comment. */
  screenshot?: string
  /** Uploads in flight, shown as placeholders. */
  uploading?: number
  /** Shows remove buttons. */
  removable?: boolean
  /** File cards link to downloads (sent messages). */
  linked?: boolean
}>(), { uploading: 0 })
const emit = defineEmits<{
  /** Detach one upload. */
  remove: [path: string]
  /** Detach the canvas screenshot. */
  removeScreenshot: []
}>()
/** Image open in the viewer. */
const viewing = shallowRef<{ src: string, name: string, href?: string }>()
</script>

<template>
  <div class="htw:flex htw:flex-wrap htw:items-center htw:gap-1.5">
    <slot />
    <AttachmentTile v-if="screenshot" name="Screenshot" :src="screenshotUrl(screenshot)" :removable="removable" @open="viewing = { src: screenshotUrl(screenshot), name: 'Screenshot' }" @remove="emit('removeScreenshot')" />
    <AttachmentTile
      v-for="file in attachments"
      :key="file.path"
      :name="file.name"
      :src="isImage(file) ? attachmentUrl(file.path) : undefined"
      :meta="isImage(file) ? undefined : attachmentMeta(file)"
      :href="linked ? attachmentUrl(file.path) : undefined"
      :removable="removable"
      @open="viewing = { src: attachmentUrl(file.path), name: file.name, href: attachmentUrl(file.path) }"
      @remove="emit('remove', file.path)"
    />
    <span v-for="index in uploading" :key="`uploading-${index}`" class="htw:grid htw:place-items-center htw:w-12 htw:h-12 htw:[border:1px_dashed_var(--histoire-border)] htw:rounded-control htw:text-muted" role="status" aria-label="Uploading" title="Uploading"><HstPulsatingDisc :size="12" /></span>
    <AttachmentViewer v-if="viewing" :src="viewing.src" :name="viewing.name" :href="viewing.href" @close="viewing = undefined" />
  </div>
</template>
