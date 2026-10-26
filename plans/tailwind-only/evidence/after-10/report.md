# Slices 06–10 serial integration pass

Integration on 2026-10-25. Changes remain local; no staging, commit, branch,
installation, or user-server operation. All builds, package suites, story builds,
and browser sessions used `/tmp/histoire-tailwind.lock`. Node 24.16.0 and cached
pnpm 10.33.0 ran with an 8 GB heap for Vitest.

## Visual result

- Full matrix: **104 captures, zero browser errors**. **100 match exactly**.
  References are `baseline/`, except the five specified font-corrected captures
  from `after-03/`. Both reference directories are unchanged; source mapping and
  hashes are in `../reference-integration-10/`.
- Four `source-changed-*` captures differ by **37 pixels each**. These are the
  colored inset edge deliberately removed by slice 10 to obey AGENTS.md's
  no-accent-edge rule. This is an intentional, non-AA difference, not a claim of
  strict pixel parity. No other difference remains. Exact changed-pixel bounds: `../remaining-differences-integration-10.json`.
- Comments: **16 before/after pairs match exactly**, covering overview, expanded
  thread, long markdown/attachments/session choices, and focused custom answer
  in light, dark, compact and narrow modes. `../diff-09/summary.json` records all
  zeroes. Original 52-file before-source snapshot still matches recorded hashes.
- Main comparison: `../diffs-integration-10/summary.json`. Initial diagnostics:
  `../after-10-initial/`, `../diffs-integration-10-initial/`, and
  `../comments-09/initial-comparison.json`.
- Final full capture was followed by a targeted 12-image Settings recapture after
  correcting viewport-row padding. No other production source changed afterward.
  A subsequent clean bundle retained byte-identical active output (see below).

## Conversion regressions fixed

- Slice 08: important horizontal row padding suppressed inline story-depth
  indentation. Only end padding now overrides the package default.
- Slice 09: restored prompt focus reset, session-chip padding and icon color,
  radio-choice spacing/alignment, pin radius and native pressed text color, and
  custom-answer margins. Escaped `in_progress`'s underscore in Tailwind's data
  selector so active plan text retains its emphasis.
- Slice 10: preserved Events' normal line-height from its legacy font shorthand;
  restored Embed state margins and code font; enabled Markdown's grid only above
  its desktop breakpoint; separated medium/narrow Settings rules, restored native
  selected navigation appearance, and preserved viewport rows' density through
  `SettingsRow.viewport`.
- No changes to slice 06/07 production source. Their canvas/toolbar/Matrix regions
  pass as part of the full matrix.

## Fixture and artifact repairs

The comments fixture now supplies actual font tokens, density CSS, provider
appearance and controls context. Its initial implementation produced identical
light/dark screenshots and omitted compact density. Both before and after sets
were regenerated with the corrected harness.

Adding fixture assets invalidates the static host's capture identity. Fixture
build now recomputes that identity through the existing production helper after
writing its assets. It does not disable integrity validation or change app code.
Capture failure reports now include outstanding request URLs.

One initial broad capture exited 143; a subsequent Matrix attempt timed out at
`page.waitForLoadState: Timeout 30000ms exceeded.` Final complete capture passed,
including all Matrix modes, with no weakened readiness checks.

Repeated Vite builds retain old chunks because `emptyOutDir` is false. Initial
`histoire test` caught this in `app-bundle-output.spec.ts`. Rebuilding with
`vite build --emptyOutDir` removed 95 obsolete generated files; all 99 retained
files were byte-identical, with no new files. Final broad unit suite passes.
Receipt: `../bundle-cleanup-integration-10.json`.

## Commands and results

Each build/suite/capture command below was wrapped in the global lock. Logs and
exit receipts: `../logs/integration-10/`.

- `pnpm --filter @histoire/controls exec vite build --config vite.peer.config.ts`:
  passed.
- `pnpm --filter @histoire/app exec vite build`, then final
  `pnpm --filter @histoire/app exec vite build --emptyOutDir`: passed.
- `pnpm --filter @histoire/app build:css` and
  `pnpm --filter @histoire/app exec node scripts/copy.mjs`: passed.
- `pnpm -C examples/vue3 story:build`: passed, 44 stories / 1,098 variants.
- `pnpm -C examples/nuxt-ui story:build`: passed, 2 stories / 22 variants.
- `serve-capture.mjs` on owned port 4614 for Vue3 and Nuxt; `compare.mjs` against
  mixed references: completed, with only the four intentional edge differences.
- `comments-09/build.mjs` with original `COMMENTS_SOURCE`, then current source;
  `serve-capture.mjs` on owned port 4613 with comments preload; `compare.mjs`:
  passed, 16/16 exact pairs. Every completed capture server logged its own stop.
- `pnpm --filter @histoire/vue test`: **155 files / 774 tests pass**.
- `pnpm --filter histoire test`: final **404 files / 2,083 tests pass**;
  one file / two tests skipped by existing suite configuration.
- `pnpm --filter histoire test:embed:integration`: **85 pass / 10 fail** across
  49 files. Nine failures exactly match slice 05. One additional content-sizing
  case hit `locator.click: Timeout 30000ms exceeded` when its visible toolbar
  item detached during startup navigation. Locked isolated rerun of the whole
  `canvas-content-sizing.spec.ts` file: **3/3 pass**. No source or test change
  was needed; the effective remaining failure set is the nine baseline failures.
  The full suite was not rerun; see `baseline-failures.json` and raw JSON/logs.
- `pnpm --filter histoire test:tailwind:integration`: **8 pass / 6 fail**;
  3 files pass / 2 fail. Failure names exactly match slice 05, with no additions.
  Representative existing failure: `expected 1 to be +0`. Exact failures
  and effective embed comparison: `baseline-failures.json`.
- `pnpm -C examples/vue3 run ci-s` with `XDG_CONFIG_HOME` and `XDG_RUNTIME_DIR`
  under `/tmp/histoire-integration-cypress`, existing `CYPRESS_CACHE_FOLDER`:
  **40 specs pass: 155 tests pass, 5 pending, zero failures**. Nested `npm run`
  also needs the temporary PATH launcher to the
  installed npm CLI; the first startup attempt otherwise hits
  `mise ERROR Read-only file system (os error 30)`. No tests ran in the failed
  startup attempts.
- Scoped ESLint and `git diff --check`: **pass**.
- Source guard: 177 Vue files across canvas, panes, comments, inspector, pages and
  embed have zero style blocks. Largest file: 290 lines. No replacement component
  CSS or `@apply` added. Marker elements retained.

Final CSS: `dist/bundled/app.css` **23,055 bytes / 4,465 gzip**;
`dist/style.css` **246,363 bytes / 31,673 gzip**. Compared with slice 05's combined
317,508 raw bytes, combined output is 15.1% smaller. Utility migration moves
rules from bundled component CSS into standalone utility output. Exact receipt:
`../css-sizes-integration-10.json`.

## Files, exceptions and remaining limits

- **Changed production files: 14.** Exact paths and reasons:
  `../files-integration-10.json`. Changes cover StoriesPanel, six comments
  components, EventsTab, EmbedDialog, MarkdownPage, and four Settings components.
- **Changed tooling: 3 files:** `../capture.mjs`, `../comments-09/build.mjs`,
  `../comments-09/main.ts`.
- **Created:** this report; capture/diff/JSON/log artifacts; mixed reference copies
  with source mapping/hashes. Updated slice 06–10 Status notes and comments README.
- **Deleted production files: none. Tests added: none.** Existing behavior suites
  cover these presentation changes; no class/style assertions added.
- **New custom-CSS exceptions: none.** Targeted important utilities fix proven E12
  conflicts (focus reset, native control geometry, state margins, code font).
  Settings viewport density uses an app-owned prop instead. No slice 11 cleanup.
- Strict all-pixel acceptance remains blocked only by the four required Source
  edge removals. Orchestrator must reconcile that reference policy; restoring the
  forbidden accent edge was not used to make the metric green.
- Static books still cannot cover live AI/MCP conversations, running tests,
  screenshot setup, populated visual review/dock, unavailable source errors, or
  enabled Embed options. Comments fixture supplements component rendering and
  focus; it does not prove live overlay geometry or agent transport.
- Packed installed-consumer checks and dependency installation were not run.
  Inherited full-build Vue declaration/root vue-tsc issues remain outside this
  pass; separate Vite/CSS/static-book outputs and listed tests are the evidence.
- Ports 6006 and 6106 were not used. Cypress uses 4567; captures use 4613/4614.
