<script setup lang="ts">
import type { HistoireDocsContent, HistoireSelectionInput, HistoireTarget } from '@histoire/protocol'
import { BuiltinIcon, HstButton } from '@histoire/controls/vue'
import { canOpenHistoireTargetInEditor, requestHistoireOpenInEditor } from '@histoire/sdk/internal'
import { HistoireDocs, useHistoireSession, useHistoireSnapshot } from '@histoire/vue'
import { computed, nextTick, ref, watch } from 'vue'

import { usePageOwnership } from '../home/ownership.js'
import MarkdownOutline from './MarkdownOutline.vue'
import MarkdownPager from './MarkdownPager.vue'
import { documentNeighbors } from './navigation.js'
import { useMarkdownOutline } from './outline.js'

const props = withDefaults(defineProps<{
  /** Existing standalone route/search documentation anchor. */
  anchor?: string
}>(), { anchor: '' })
const emit = defineEmits<{
  /** Successful guide selection; SDK facade keeps URL ownership. */
  select: [target: HistoireTarget]
  /** Content, selection, editor or clipboard failure. */
  error: [error: unknown]
}>()
const session = useHistoireSession()
const ownership = usePageOwnership(session)
const snapshot = useHistoireSnapshot()
const root = ref<HTMLElement | null>(null)
const outline = useMarkdownOutline(root)
const story = computed(() => snapshot.value.catalog.stories.find(story => story.id === snapshot.value.selection?.storyId))
const pager = computed(() => documentNeighbors(snapshot.value.catalog, story.value))
const path = ref<string>()
const titleInContent = ref(false)
const loaded = ref(false)
const empty = ref(false)
const copied = ref(false)
const currentAnchor = ref(props.anchor)
const canEdit = computed(() => __HISTOIRE_DEV__ && canOpenHistoireTargetInEditor(snapshot.value))
watch(() => props.anchor, value => currentAnchor.value = value)

/** Preserve rendered IDs while avoiding double encoding copied local anchors. */
function encodedAnchor(anchor: string): string {
  const value = anchor.replace(/^#/, '')
  try {
    return encodeURIComponent(decodeURIComponent(value))
  }
  catch { return encodeURIComponent(value) }
}
// Unrelated settings/catalog projections preserve the current document's scroll and metadata.
watch([
  () => snapshot.value.status,
  () => snapshot.value.stale,
  () => snapshot.value.source?.sourceId,
  () => snapshot.value.source?.epoch,
  () => snapshot.value.source?.revision,
  () => story.value?.id,
], () => {
  path.value = undefined
  titleInContent.value = false
  loaded.value = false
  empty.value = false
  copied.value = false
  currentAnchor.value = props.anchor
  if (root.value) root.value.scrollTop = 0
  void nextTick().then(outline.refresh)
}, { flush: 'sync' })

/** Renderer stays authoritative; outline waits until its committed DOM is available. */
async function content(value: HistoireDocsContent): Promise<void> {
  const owner = ownership.capture()
  if (!ownership.owns(owner) || value.storyId !== story.value?.id || value.epoch !== owner.source?.epoch || value.revision !== owner.source?.revision) return
  path.value = value.relativePath
  empty.value = !value.body.trim()
  await nextTick()
  if (!ownership.owns(owner)) return
  titleInContent.value = !!root.value?.querySelector('.histoire-docs h1')
  loaded.value = true
  outline.refresh()
}

/** Current canonical guide target dispatches through existing finite editor action. */
async function edit(): Promise<void> {
  if (!canEdit.value || !story.value) return
  const owner = ownership.capture()
  try {
    await requestHistoireOpenInEditor(session, { storyId: story.value.id, variantId: null })
  }
  catch (error) { if (ownership.owns(owner)) emit('error', error) }
}

/** Preserve router URL, including hash-router route, when copying local outline anchor. */
async function copyLink(): Promise<void> {
  const window = root.value?.ownerDocument.defaultView
  if (!window) return
  const url = new URL(window.location.href)
  if (currentAnchor.value) {
    const anchor = encodedAnchor(currentAnchor.value)
    if (url.hash.startsWith('#/')) url.hash = `${url.hash.split('#').slice(0, 2).join('#')}#${anchor}`
    else url.hash = anchor
  }
  const owner = ownership.capture()
  try {
    await window.navigator.clipboard.writeText(url.href)
    if (ownership.owns(owner)) copied.value = true
  }
  catch (error) { if (ownership.owns(owner)) emit('error', error) }
}

/** Prev/next stays in the same catalog group and never requests a preview variant. */
async function select(target: HistoireSelectionInput): Promise<void> {
  await ownership.select(target, selected => emit('select', selected), error => emit('error', error))
}
</script>

<template>
  <main ref="root" class="histoire-markdown-page htw:h-full htw:overflow-auto htw:dark:bg-canvas htw:bg-surface htw:text-text" data-histoire-docs-scroll>
    <div class="htw:flex htw:justify-end htw:gap-[8px] htw:p-[20px_24px_0]">
      <HstButton v-if="canEdit" color="default" type="button" @click="edit">
        <BuiltinIcon icon="edit" :size="16" />Edit .md
      </HstButton>
      <HstButton icon-only color="default" type="button" :aria-label="copied ? 'Link copied' : 'Copy link'" :title="copied ? 'Link copied' : 'Copy link'" @click="copyLink">
        <BuiltinIcon :icon="copied ? 'checkmark-filled' : 'link'" :size="16" />
      </HstButton>
    </div>
    <div class="htw:min-[1101px]:grid htw:[grid-template-columns:minmax(0,_680px)_200px] htw:gap-[60px] htw:max-w-[1040px] htw:m-[0_auto] htw:p-[6px_40px_48px] htw:[@media(max-width:_1100px)]:max-w-[760px] htw:[@media(max-width:_600px)]:p-[20px_20px_36px]">
      <article class="htw:min-w-0">
        <p class="histoire-markdown-path htw:flex htw:items-center htw:gap-[8px] htw:m-[0_0_20px] htw:text-muted htw:text-[12px] htw:[overflow-wrap:anywhere]">
          <BuiltinIcon icon="document" :size="16" />{{ path ?? story?.relativePath ?? story?.title }}
        </p>
        <h1 v-if="!story?.content.docs || (loaded && !titleInContent)" class="htw:m-[0_0_20px] htw:text-text htw:text-[36px] htw:font-extrabold htw:tracking-[-.02em] htw:leading-[1.2] htw:[@media(max-width:600px)]:text-[28px]">
          {{ story?.title }}
        </h1>
        <HistoireDocs v-if="story?.content.docs" :key="story.id" :classes="{ root: 'htw:overflow-visible htw:p-0 htw:text-body htw:text-[15px] htw:leading-[1.75] htw:[&_h1]:m-[0_0_20px] htw:[&_h1]:text-text htw:[&_h1]:text-[36px] htw:[&_h1]:font-extrabold htw:[&_h1]:tracking-[-.02em] htw:[&_h1]:leading-[1.2] htw:[&_h2]:m-[28px_0_14px] htw:[&_h2]:text-text htw:[&_h2]:text-[21px] htw:[&_h2]:font-extrabold htw:[&_h2]:leading-[1.3] htw:[&_h3]:m-[24px_0_12px] htw:[&_h3]:text-text htw:[&_h3]:text-[17px] htw:[&_h3]:font-extrabold htw:[&_a]:text-accent-link htw:[&_a.header-anchor]:ml-[6px] htw:[&_a.header-anchor]:opacity-0 htw:[&_a.header-anchor]:no-underline htw:[&_:is(h1,h2,h3):hover_a.header-anchor]:opacity-100 htw:[&_a.header-anchor:focus-visible]:opacity-100 htw:[&_:is(code,pre)]:font-mono htw:[&_:is(code,pre)]:text-[.9em] htw:[&_pre]:overflow-auto htw:[&_pre]:m-[18px_0_26px] htw:[&_pre]:py-[12px] htw:[&_pre]:px-[16px] htw:[&_pre]:rounded-[10px] htw:[&_pre]:bg-code htw:[&_pre]:text-[#e6e7ea] htw:[&_:not(pre)>code]:py-[2px] htw:[&_:not(pre)>code]:px-[4px] htw:[&_:not(pre)>code]:rounded-[4px] htw:[&_:not(pre)>code]:bg-chip htw:[&_blockquote]:my-[16px] htw:[&_blockquote]:mx-0 htw:[&_blockquote]:py-[10px] htw:[&_blockquote]:px-[14px] htw:[&_blockquote]:border htw:[&_blockquote]:border-border htw:[&_blockquote]:rounded-[8px] htw:[&_blockquote]:bg-accent-soft htw:[&_blockquote>p]:m-0 htw:[&_table]:w-full htw:[&_table]:border-collapse htw:[&_:is(td,th)]:py-[8px] htw:[&_:is(td,th)]:px-[10px] htw:[&_:is(td,th)]:border htw:[&_:is(td,th)]:border-border htw:[&_:is(td,th)]:text-left htw:[&_iframe]:block htw:[&_iframe]:w-full htw:[&_iframe]:border htw:[&_iframe]:border-border htw:[&_iframe]:rounded-[12px] htw:[@media(max-width:600px)]:[&_h1]:text-[28px]' }" :anchor="anchor" @anchor="currentAnchor = $event; copied = false" @content="content" @error="emit('error', $event)" />
        <p v-if="empty || !story?.content.docs" class="htw:text-muted">
          No Markdown content for {{ path ?? story?.relativePath ?? story?.title }}.
        </p>
        <MarkdownPager :previous="pager.previous" :next="pager.next" @select="select" />
      </article>
      <MarkdownOutline :headings="outline.headings.value" :active="outline.active.value" @select="outline.select($event); currentAnchor = $event.id; copied = false" />
    </div>
  </main>
</template>
