# 09 — Comments

## Outcome and prerequisites

Depends on: 05. Comment canvas overlay, cards, threads, agent activity/plan, agent markdown, prompt (attachments, session list) and questions use utilities.

## Owned files

[Inventory slice 09](inventory.md#slice-09): `components/comments/*`, `comments/prompt/*`, `comments/thread/*`, `comments/thread/questions/*` (incl. `questions.css`).

Order: thread primitives (`AgentMarkdown`, `AgentPlan*`, `AgentActivityPhase`) → questions → prompt (`AttachmentTile`, `SessionRadioList`, `AgentPrompt`) → `CommentContext`, `CommentComposer` → `CommentsCanvasOverlay`.

## Implementation steps

1. **Agent markdown (`v-html`).** Rule 7: `htw:prose htw:prose-sm` plus overrides via `htw:prose-pre:…`, `htw:prose-code:…`, `htw:prose-a:…`, and `htw:[&>:last-child]:mb-0`. Match today's compact spacing (`:is(p, ul, ol, pre, blockquote, table)` margins, heading sizes). Keep `agent-markdown` marker. If typography defaults fight compact sizing in more than a few places, use arbitrary descendant variants only, no `prose`.
2. **Questions.** `questions.css` (`.agent-question …`) into question components; delete file.
3. **Plan and activity.** `data-state` / `data-status` chains → data variants; reduced-motion queries → `htw:motion-reduce:`. Status dots via `htw:before:` utilities.
4. **Prompt.** `AgentPrompt` `:deep(button)` → classes on its own buttons; keep `agent-prompt` marker. `SessionRadioList` `:deep(button[aria-checked="true"])` → `htw:aria-checked:` on its own buttons. `AttachmentTile` (14 rules) straightforward.
5. **Context/composer.** `CommentComposer` `:deep(.comment-context)` → prop on `CommentContext`. `CommentContext` `:deep(button)` → own buttons.
6. **Canvas overlay.** `CommentsCanvasOverlay` `:deep(.comment-card|.comment-thread)` → props on those components (placement/elevation). Keep `.histoire-canvas-viewport` lookups (`dismiss-outside.ts`) intact.

## Failure paths

- Markdown from agents may contain tables, nested lists, long code: test with a long fixture thread in the browser before/after.

## Validation commands

Per [folder slice procedure](architecture.md#folder-slice-procedure-0510) plus `pnpm --filter @histoire/vue test` (`comment-thread.spec.ts` uses `.agent-markdown`, `.agent-prompt`). Browser: overlay pins, open thread, agent plan with decisions, activity phases, prompt with attachments and session list, questions; light/dark/compact.

## Acceptance criteria

No `<style>`/`.css` in owned folders; comment specs green; matrix rows unchanged.

## Non-goals

Comment behavior, markdown rendering pipeline.

## Status

Not started.
