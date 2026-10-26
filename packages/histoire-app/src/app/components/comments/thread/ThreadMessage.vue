<script setup lang="ts">
import type { UiCommentMessage } from '@histoire/shared'
import { BuiltinIcon } from '@histoire/controls/vue'
import { computed } from 'vue'
import AgentLogo from '../../agents/AgentLogo.vue'
import { commentAge } from '../presentation.js'
import AttachmentStrip from '../prompt/AttachmentStrip.vue'
import { groupActivityPhases } from './activity-phases.js'
import AgentActivityPhase from './AgentActivityPhase.vue'
import AgentMarkdown from './AgentMarkdown.vue'
import AgentPlan from './AgentPlan.vue'
import AgentPlanDecision from './AgentPlanDecision.vue'

const props = defineProps<{
  /** Message origin. */
  author: UiCommentMessage['author']
  /** Display name. */
  name: string
  /** Agent registry logo URL. */
  icon?: string
  /** UTC message time; omitted while streaming. */
  at?: string
  /** Plain user text or agent markdown. */
  body: string
  /** Agent steps preceding the reply text. */
  steps?: UiCommentMessage['steps']
  /** Last plan the agent reported for this reply. */
  plan?: UiCommentMessage['plan']
  /** Plan approval answers given during this reply. */
  decisions?: UiCommentMessage['decisions']
  /** Agent-reported file edits. */
  changes?: UiCommentMessage['changes']
  /** Agent request failure notice. */
  failed?: boolean
  /** Reply is still being produced. */
  streaming?: boolean
  /** Files attached to a user message. */
  attachments?: UiCommentMessage['attachments']
}>()
const phases = computed(() => groupActivityPhases(props.steps ?? []))
</script>

<template>
  <article class="htw:flex htw:gap-2.5 htw:mt-0 htw:mx-0 htw:mb-4.5 htw:group/message htw:last:mb-0" :data-author="author">
    <span class="htw:grid htw:place-items-center htw:flex-none htw:w-7 htw:h-7 htw:rounded-full htw:bg-chip htw:text-muted htw:group-data-[author=agent]/message:bg-agent-soft htw:group-data-[author=agent]/message:text-agent-text">
      <AgentLogo v-if="author === 'agent'" :icon="icon" :size="16" />
      <BuiltinIcon v-else icon="user-avatar" :size="16" />
    </span>
    <div class="htw:min-w-0 htw:flex-1">
      <header class="htw:flex htw:flex-wrap htw:items-baseline htw:gap-1.75 htw:mb-1">
        <strong class="htw:text-[12px]">{{ name }}</strong><time v-if="at" :datetime="at" :title="at" class="htw:text-muted htw:text-[11px]">{{ commentAge(at) }}</time>
      </header>
      <AgentPlan v-if="plan?.length" :entries="plan" :live="streaming" />
      <div v-if="phases.length" class="htw:grid htw:[grid-template-columns:minmax(0,_1fr)] htw:gap-0.25 htw:mb-1.5">
        <AgentActivityPhase v-for="phase in phases" :key="phase.id" :phase="phase" />
      </div>
      <AgentPlanDecision v-for="(decision, index) in decisions" :key="index" :decision="decision" />
      <p v-if="failed" class="failed htw:m-0 htw:text-[12px] htw:leading-[1.6] htw:whitespace-pre-wrap htw:wrap-anywhere htw:flex htw:items-center htw:gap-1.5 htw:text-danger-text" role="alert">
        <BuiltinIcon icon="error-filled" :size="14" />{{ body }}
      </p>
      <AgentMarkdown v-else-if="author === 'agent' && body" :text="body" :streaming="streaming" />
      <p v-else-if="body" class="plain htw:m-0 htw:text-[12px] htw:leading-[1.6] htw:text-body htw:whitespace-pre-wrap htw:wrap-anywhere">
        {{ body }}
      </p>
      <AttachmentStrip v-if="attachments?.length" class="attachments htw:mt-1.5" :attachments="attachments" linked />
      <code v-for="change in changes" :key="change.file" class="htw:flex htw:items-center htw:flex-wrap htw:gap-1.25 htw:w-fit htw:mt-1.5 htw:py-1.25 htw:px-1.75 htw:rounded-[6px] htw:bg-chip htw:text-[10px] htw:wrap-anywhere"><BuiltinIcon icon="code" :size="16" />{{ change.file }} <span class="added htw:text-accent-link">+{{ change.added }}</span><span class="removed htw:text-danger-text">-{{ change.removed }}</span></code>
      <slot />
    </div>
  </article>
</template>
