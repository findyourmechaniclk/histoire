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

Conversion and serial fixture validation complete: all 16 before/after pairs
match exactly. Changes remain local; current results are under Integration pass.

### Landed

- Converted all 24 styled comment Vue components and removed `questions.css`.
  Its rules now live on the five previously unstyled question owners listed in
  the inventory addition. No `<style>`, `:deep()` or component CSS remains.
- Six small native-root primitives remove repeated utility lists:
  `CommentContextChip`, `AgentDisclosure`, `QuestionActions`, `QuestionInput`,
  `QuestionOption`, `QuestionOptionLabel`. Native event/attribute fallthrough,
  focus targets, form submission, and existing marker classes are retained.
- `CommentComposer.flat` and `CommentThread.flat` delegate elevation to the
  overlay scroll wrapper; `CommentContext.borderless` lets the composer own its
  divider. Existing defaults remain unchanged. No shared shell/base or package
  source edits.
- Markdown keeps its compact existing element contract through literal arbitrary
  descendant variants rather than `prose`, whose defaults would add new spacing.
  Named data groups cover entry status, message author, compact prompts, image
  attachments and decisions. Explicit Vue transition classes retain overlay
  error motion and reduced-motion behavior.
- Existing compound controls selectors require local `!` utilities on pin
  height/background/text/focus and attachment-remove backgrounds. No suitable
  existing hook changes these per-button declarations; the override stays on
  the actual button. No new custom-CSS exceptions.

### Evidence and deviations

- Baseline pack explicitly excludes comments (`baseline.md`, static-only
  coverage limits). Added isolated real-component fixture under
  `evidence/comments-09/`, using static assets and the existing preview/capture
  runner on owned port 4613. Its intended `before-09` captures use an immutable source
  snapshot taken before this slice; they supplement, not replace, official
  `baseline/` or `after-03/`. Neither reference directory is modified.
- Fixture is prepared for long markdown/code/tables/nested lists, completed/running
  plan entries, failed activity, plan decisions, question choices, attachments,
  selected session choices, composer, thread and pins. Full live canvas geometry
  and server-driven conversations remain outside static-book coverage.

### Validation results

- Scoped ESLint: passed, including fixture source.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter @histoire/vue exec vitest run src/__tests__/comment-thread.spec.ts`: 10 passed.
- Same command for `agent-pending-input.spec.ts`: 6 passed; confirms native
  question inputs, focus and submission survive primitive extraction.
- `vue-tsc --noEmit -p packages/histoire-app/tsconfig.workbench.json`: unavailable,
  `Command "vue-tsc" not found`. No install attempted.
- Shell's default mise shim failed with `Read-only file system (os error 30)`;
  validation now uses existing Node 24.16.0 and pnpm 10.27.0 binaries via PATH.
- `flock /tmp/histoire-tailwind.lock` with
  `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter @histoire/vue test`:
  **155 files / 774 tests pass**. Subsequent marker-only cleanup re-ran
  `comment-thread.spec.ts`: **10 tests pass**.
- `comment-composer.spec.ts`: **8 tests pass**. No new tests: styling and
  optional presentation props reuse existing behavior coverage without
  class/style assertions. `git diff --check` passes; zero style blocks/CSS
  files remain across 37 comment Vue components, all owned source files <300 lines.
- Locked `pnpm --filter @histoire/app build:css`: passes. Locked isolated
  baseline fixture Vite build: passes after its Vue import was resolved through
  the existing vendor runtime. These do not prove the full app build.
- Initial capture starts and stops its own server PID 131, then reports
  `Server exited during startup; see server.log`. The preload path was relative
  while the child server runs from `examples/vue3`; corrected to an absolute
  preload in the retry instructions. No successful PNG was produced.
- Full app build, paired before/after capture+compare, and static Vue3 story
  build were queued under the lock but never started. Lock remained held for
  several minutes; a final `flock -w 5 /tmp/histoire-tailwind.lock true` returned
  **1**. Interrupted only these three owned queued sessions (exit **130**), so
  they cannot run unexpectedly after handoff. No other processes were stopped.
- **No screenshot diff or visual-parity claim.** `baseline/` and `after-03/`
  remain untouched. `evidence/css-sizes-09.json` is a shared-checkout observation,
  not a verified slice delta; final CSS sizes require a fresh locked app build.

### Handoff

- Exact created/changed/deleted source inventory: `evidence/files-09.json`.
  Commands/logs: `evidence/logs/09/`. Immutable before-source hashes:
  `evidence/before-09/source.json`.
- Resume commands and fixture limits: `evidence/comments-09/README.md`.
  Once the global lock is available, run full app build, required asset steps,
  Vue3 story build, paired fixture captures (all four cases/modes), and comparator;
  fix or explain every diff. Recheck actual canvas overlays with the orchestrator's
  live runtime, since static books do not expose comments.
- Root `vue-tsc` dependency remains unavailable. No dependency install, staging,
  commit, branch, stash, or changes outside owned comments and plan/evidence files.

### Integration pass — 2026-10-25

Paired fixture now completes: **16/16 images match exactly**, with zero browser
errors in light, dark, compact and narrow modes. Before source still matches its
52 recorded file hashes. Fixture now supplies real font tokens, density CSS,
provider appearance and controls context. It refreshes generated capture identity
after adding public assets; integrity checking stays enabled.

Fixed prompt textarea focus reset; pin radius and package-owned pressed text;
session-chip padding/fallback icon color; radio-choice padding/alignment; and
custom-answer margin. Escaped the underscore in `in_progress` data variants so
running plan text gets the original emphasis. E12 requires targeted important
utilities for those native focus/geometry/margin conflicts; no new CSS exception.
No class/style tests added. Existing Vue suite passes 155 files / 774 tests,
including comment behavior; Histoire passes 404 files / 2,083 tests.

Commands, broad gates and remaining live-runtime limits:
[integration report](evidence/after-10/report.md). Pair comparison:
evidence/diff-09/summary.json.

Integration gate result: embed 85 passed / 10 failed initially, with the extra
startup-navigation failure cleared by a 3/3 content-sizing file rerun; effective
remaining failures match all nine slice 05 baselines. Tailwind: 8 passed / 6
failed, exact slice 05 failure set. Cypress result is in the integration report.

Cypress integration: all 40 specs pass, 155 tests pass / 5 pending / zero
failures, using the documented XDG workaround and installed npm CLI through
a temporary PATH launcher. No dependency installation or user-server changes.
