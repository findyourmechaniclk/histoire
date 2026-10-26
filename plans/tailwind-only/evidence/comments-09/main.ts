import { createApp, defineComponent, h, ref } from 'vue'
import CommentComposer from '../../../../packages/histoire-app/src/app/components/comments/CommentComposer.vue'
import CommentPin from '../../../../packages/histoire-app/src/app/components/comments/CommentPin.vue'
import CommentThread from '../../../../packages/histoire-app/src/app/components/comments/CommentThread.vue'
import AttachmentTile from '../../../../packages/histoire-app/src/app/components/comments/prompt/AttachmentTile.vue'
import PromptSuggestions from '../../../../packages/histoire-app/src/app/components/comments/prompt/PromptSuggestions.vue'
import SessionRadioList from '../../../../packages/histoire-app/src/app/components/comments/prompt/SessionRadioList.vue'
import AgentElicitation from '../../../../packages/histoire-app/src/app/components/comments/thread/questions/AgentElicitation.vue'
import AgentPlanApproval from '../../../../packages/histoire-app/src/app/components/comments/thread/questions/AgentPlanApproval.vue'
import ThreadMessage from '../../../../packages/histoire-app/src/app/components/comments/thread/ThreadMessage.vue'
import { provideHistoireControls } from '../../../../packages/histoire-controls/src/context'
import '../../../../packages/histoire-app/src/app/style/density.css'

/** Stable, offline visual data; no agent process or project mutation. */
const draft = { id: 'visual', context: { storyId: 'button', variantId: 'primary' }, anchor: { x: 10, y: 20, selector: '#app > button' }, props: { size: 'sm' }, body: 'Keep width while loading' }
const agents = [{ id: 'codex', name: 'Codex', state: 'idle' }]
const markdown = '# Rendering checks\n\nParagraph with **strong**, *emphasis*, `code`, and [link](https://example.com).\n\n- Nested list\n  - Second level\n\n> Quoted guidance\n\n| Name | Value |\n| --- | --- |\n| Long entry | content |\n\n```ts\nconst longValue = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz"\n```'
const thread = { ...draft, title: draft.body, status: 'replied', agentId: 'codex', createdAt: '2026-10-25T11:59:00Z', updatedAt: '2026-10-25T11:59:00Z', thread: [{ author: 'agent', agentId: 'codex', at: '2026-10-25T11:59:00Z', body: markdown, plan: [{ content: 'Inspect target', status: 'completed' }, { content: 'Preserve layout', status: 'in_progress' }], steps: [{ id: 'read', kind: 'read', title: 'Read Button.vue', target: 'src/Button.vue', status: 'completed' }, { id: 'edit', kind: 'edit', title: 'Edit Button.vue', status: 'failed', added: 2, removed: 1 }], decisions: [{ plan: '- Preserve behavior\n- Verify layout', outcome: 'approved' }] }] }
const question = { requestId: 'question', agentId: 'codex', threadId: 'visual', mode: 'form', message: 'Choose spacing', fields: [{ key: 'spacing', type: 'choice', title: 'Density', required: true, default: 'comfortable', options: [{ value: 'comfortable', label: 'Comfortable (Recommended)', description: 'Room for every action' }, { value: 'compact', label: 'Compact', description: 'More rows' }] }, { key: 'spacing_custom', type: 'text', title: 'Other' }] }
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#667788"/><circle cx="24" cy="24" r="14" fill="#c9d3dd"/></svg>')}`

/** Mount real components in independent fixture cards for static-book capture. */
createApp(defineComponent({
  setup() {
    const selected = ref('comfortable')
    const density = JSON.parse(localStorage.getItem('_histoire-ui-settings') ?? '{}').density ?? 'comfortable'
    const dark = ref(localStorage.getItem('histoire-color-scheme') === 'dark')
    provideHistoireControls({ dark, overlay: ref(null) })
    document.documentElement.classList.toggle('htw-dark', dark.value)
    return () => h('div', { 'class': 'histoire-app histoire-provider histoire-shell-layout', 'data-density': density, 'data-histoire-appearance': dark.value ? 'dark' : 'light', 'style': '--histoire-font-sans:"Manrope",system-ui,sans-serif;--histoire-font-mono:"JetBrains Mono",ui-monospace,monospace;display:block;min-height:100vh;padding:24px;background:var(--histoire-canvas);color:var(--histoire-text);font-family:var(--histoire-font-sans,"Manrope",system-ui,sans-serif)' }, [
      h('div', { style: 'display:flex;align-items:start;flex-wrap:wrap;gap:24px' }, [
        h('div', { style: 'width:360px;max-width:100%' }, [h(CommentComposer, { draft, title: 'Button › Primary', agents }), h('div', { style: 'display:flex;gap:16px;padding:16px' }, [h(CommentPin, { number: 1 }), h(CommentPin, { number: 2, active: true }), h(CommentPin, { number: 3, resolved: true }), h(CommentPin, { temporary: true, active: true })]), h(AgentElicitation, { request: question }), h(AgentPlanApproval, { request: { requestId: 'plan', agentId: 'codex', detail: 'Ready to code?', plan: markdown, choices: [{ id: 'approve', label: 'Approve', intent: 'approve' }, { id: 'reject', label: 'Keep planning', intent: 'reject' }] } })]),
        h(CommentThread, { thread, title: 'Button › Primary', agents }),
        h('div', { style: 'width:360px;max-width:100%;padding:12px;background:var(--histoire-surface)' }, [h(ThreadMessage, { author: 'agent', name: 'Codex', body: markdown }), h('div', { style: 'display:flex;gap:6px;margin:12px 0' }, [h(AttachmentTile, { name: 'Image', src: image, removable: true }), h(AttachmentTile, { name: 'notes.txt', meta: 'TXT · 1 KB', removable: true })]), h(SessionRadioList, { label: 'Model', selector: { options: [{ value: 'comfortable', label: 'Default' }, { value: 'compact', label: 'Fast' }] }, current: selected.value, onPick: value => selected.value = value }), h('div', { style: 'position:relative;margin-top:160px' }, [h(PromptSuggestions, { id: 'suggestions', label: 'Files', active: 0, items: [{ id: 'button', label: 'Button.vue', detail: 'src/components', icon: 'document' }, { id: 'app', label: 'App.vue', detail: 'src', icon: 'document' }] })])]),
      ]),
    ])
  },
})).mount('#app')
