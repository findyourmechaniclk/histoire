# 10 — Inspector, embed dialog and pages

## Outcome and prerequisites

Depends on: 04 (hooks for events, docs, tests, controls, source, extension views), 05 (states). Inspector tabs and bodies, Source drawer, embed dialog, home, settings and markdown pages use utilities. The biggest cross-package consumer: switches to slice 04 hooks.

## Owned files

[Inventory slice 10](inventory.md#slice-10): `components/inspector/*`, `components/embed/EmbedDialog.vue`, `components/pages/home/*` (incl. `home.css`), `components/pages/settings/*` (incl. `settings.css`, `agents-settings.css`), `components/pages/markdown/*` (incl. `markdown.css`).

Order: inspector (`InspectorTabs`, `PropsTab`, tab bodies, `SourceDrawer`, `StoryInspector`) → embed dialog → home → settings → markdown.

## Implementation steps

1. **`StoryInspector` (17 `:deep`).** Docs, events, tests, extension views → `classes` parts from slice 04, applied where those components are rendered (tab body components `DocsTab`, `EventsTab`, `TestsTab`). `[data-active-tab="docs"] :deep(.inspector-source)` → `SourceDrawer` prop (`tone="surface"`). Inspector gutter via theme spacing (`--histoire-inspector-gutter` gets a theme entry in slice 03 if missing). Keep `histoire-inspector-frame`, `inspector-source`, `inspector-source-retry`.
2. **Dynamic class.** `` `inspector-test-${status}` ``: replace with a status → class-string map so the scanner sees literals; keep the old class only if a test or JS reads it (grep first).
3. **`PropsTab`.** Controls, presets, reset, legend/fieldset → slice 04 parts; `calc(var(--histoire-inspector-gutter) - var(--histoire-control-wrapper-padding))` → arbitrary value with both variables. `.workbench-state` → fallthrough class/`fill` prop.
4. **`SourceDrawer`.** `HistoireSource` parts and `showActions: false`; changed-line highlight per slice 04 decision (part or rule 7 on `pre`: `htw:[&_.line[data-source-changed]]:bg-accent/15`). Hard-coded `#f87171` alert color → token (`htw:text-danger`, check dark contrast against baseline). `background: transparent !important` on `pre` overrides Shiki inline style: keep as `htw:bg-transparent!` on the `pre` part, recorded as acceptable `!`.
5. **`InspectorTabs`** `:deep(svg)` → icon size prop.
6. **`EmbedDialog`** (41 rules): `label:has(:checked|:disabled)` → `htw:has-checked:`/`htw:has-disabled:`; button group via slice 04 hook; split the component if the template passes 300 lines.
7. **Home.** `home.css` exists to beat `.histoire-button[data-color]`: slice 04 variant removes the fight; delete file. Breakpoints 1100/1000 px → `htw:max-[1099px]:` (or theme `--breakpoint-*` if reused). `NeedsAttention` `.row + .row` → `htw:divide-y` / `htw:[&+&]:` on rows.
8. **Settings.** `settings.css`, `agents-settings.css` (`:has()`, `::before` state dots, `::-webkit-details-marker`, selects/switches/button groups via slice 04): into components; details marker via `htw:[&::-webkit-details-marker]:hidden htw:list-none`. Keep `histoire-settings-content`.
9. **Markdown page.** `markdown.css` styles user docs under `.histoire-docs` (rule 7): `htw:prose` on the docs root plus overrides for header anchors (from `main.pcss` `.htw-prose` rule), tables, code, blockquotes; grid `minmax(0,680px) 200px` → `htw:grid-cols-[minmax(0,680px)_200px]`; dark selector → `htw:dark:`. Keep `histoire-docs`, `header-anchor`, `histoire-markdown-path` markers (outline DOM and `MarkdownPage.vue:76` query them). Delete file.

## Failure paths

- Docs rendered both in inspector (compact) and markdown page (full): two prose configurations on two roots; do not share via global CSS.
- `outline-dom.ts` scans `.header-anchor`; typography changes must not drop anchors.

## Validation commands

Per [folder slice procedure](architecture.md#folder-slice-procedure-0510) plus `pnpm --filter @histoire/vue test` (`inspector-extensions`, `source-expansion`, `standalone-docs-links`), `pnpm --filter histoire test:embed:integration` (`inspector-plugin-tab`). Browser: all inspector tabs incl. plugin tab, events with many entries, Source drawer changed lines and error, embed dialog options, home at 1440/1024/375, settings general/agents, markdown page with outline.

## Acceptance criteria

No `<style>`/`.css` in owned folders; no app selector into package internals remains; matrix rows unchanged.

## Non-goals

Inspector behavior, docs rendering pipeline.

## Status

Code implemented locally on 2026-10-25. Serial integration completed final
rebuild and capture; four required Source-edge removals remain intentional
non-AA differences. Current gates supersede historical lock blockers below.
Nothing staged, committed, pushed or installed.

### Files and implementation

- Converted all 20 owned Vue style blocks and all consumers of the four shared
  stylesheets to literal Tailwind v4 utilities. Deleted `home.css`,
  `settings.css`, `agents-settings.css`, and `markdown.css`; no replacement CSS.
- Added local `HomeCard`, `HomeHeading`, `HomeRow`, `SettingsCard`, `SettingsRow`,
  `SettingsChoices`, `AgentLaunchField`, `SourceAction`, and
  `InspectorExtensionOutlet` components for repeated layouts. All owned Vue
  files are at most 204 lines. Exact source changes: `evidence/files-10.json`;
  line-count/style scan: `evidence/source-scan-10.json`.
- Preserved inventory markers on their original elements. Also retained the
  capture selectors `histoire-home-page`, `histoire-markdown-page`, and
  `histoire-settings-plugin`; inspector's native new-tab link retains
  `histoire-icon-button` for package sizing.
- Native docs, events, controls, tests and source consume existing `classes`
  parts. Empty/loading state margins and flex use classes directly on those
  state components, avoiding extra wrappers. Extension outlets use the
  existing slot and `ExtensionView.classes` contract.
- Source drawer owns its expansion data attribute and optional surface tone.
  Tab labels use direct-child variants so detached measurement clones remain
  naturally sized. Agent disclosure icons follow a named native-open group.
- Additive shared-package change: `HstButtonGroup.classes` exposes `options`
  and `option`. Slice 04 had `block` but no choice-container/button passthrough;
  settings needs wrapping and content-based flex without descendant selectors.
  Existing defaults, events, keyboard focus and marker classes are unchanged.
  No shared shell/base/menu or theme file changes.

### Deviations and exceptions

- **No new CSS exceptions.** E12 requires `!` on conflicts with provider-scoped
  package declarations: button/group geometry, selected navigation appearance,
  inline control margins, panel padding, source typography and Shiki's inline
  background. Root/part hooks choose the target; the modifier handles remaining
  specificity. Events time/margins and Tests font size also override their
  native provider selectors.
- Markdown uses existing native typography plus root-scoped foreign-content
  utilities instead of enabling `prose`, whose additional defaults would
  change the existing document rendering contract. Full page and inspector
  typography remain separate.
- Source changed lines retain the 15% accent background. Removed their colored
  inset edge, as required by the user's no-accent-edge rule. Source error text
  now uses `danger`. These intentional differences still need visual review.
- Shared CSS had additional style-free consumers absent from the byte-count
  inventory. Their ownership and the new local primitives are appended to
  `inventory.md`.

### Commands and results

All commands use installed Node 24.16.0 / cached pnpm 10.33.0. Vitest and vue-tsc
use `NODE_OPTIONS=--max-old-space-size=8192`. Package suites/build attempts are
wrapped in `flock /tmp/histoire-tailwind.lock`; single-file reruns are unlocked.
Logs: `evidence/logs/10/`.

- `pnpm --filter @histoire/vue test`: **155 files / 774 tests pass**.
- Focused final checks: `source-expansion.spec.ts` **6/6**,
  `workbench-agent-settings.spec.ts` **9/9**, `inspector-extensions.spec.ts`
  **7/7**. No new tests; existing behavior checks cover the wrapper changes.
- `pnpm --filter @histoire/app build`: Vite stage passes; complete command fails
  at inherited embed declarations: `Module '"vue"' has no exported member
  'createApp'`. This earlier bundle predates final local cleanup, so it is not
  final-source build proof.
- `pnpm exec vue-tsc --noEmit -p packages/histoire-app/tsconfig.workbench.json`:
  `Command "vue-tsc" not found`. Installed controls vue-tsc runs but fails on
  existing Vue/vendor declarations (including missing Vue named exports).
- Scoped ESLint and owned `git diff --check`: **pass**. Source scan: **zero
  `<style>` blocks or component CSS files** in owned scope; zero `:deep()`.
- Final controls peer bundle, app Vite/CSS/copy, Vue3 static-book build and
  capture command were queued behind the lock and never started. First queued
  rebuild exited 143; two separate `flock -w 20` probes exited 1 without acquiring
  it. Other tracks report the same persistent lock failure. Waiting Track D
  jobs are guarded from starting artifact work after handoff.
- `pnpm --filter histoire test:embed:integration inspector-plugin-tab
  scoped-embed-dialog`: queued but **not run** because of the same lock.

### Visual evidence and remaining work

**Zero new screenshots; no pixel-parity claim.** No server was started; port
4614 and reserved ports 6006/6106 were not used. Baseline and after-03 are
unchanged. `evidence/reference-10/` prepares the 44 expected references, taking
plugin-inspector light/dark/compact from after-03 and everything else from
baseline; `sources.json` records each source.

Orchestrator must release/identify the existing lock holder, rebuild final
sources, then run (inside the lock):

```bash
pnpm --filter @histoire/controls exec vite build --config vite.peer.config.ts
pnpm --filter @histoire/app exec vite build
pnpm --filter @histoire/app build:css
pnpm --filter @histoire/app exec node scripts/copy.mjs
pnpm -C examples/vue3 story:build
node plans/tailwind-only/evidence/serve-capture.mjs \
  --out plans/tailwind-only/evidence/after-10 --port 4614 \
  --only '{home,inspector-*,source-changed,settings-*,markdown,embed-dialog,plugin-inspector}'
node plans/tailwind-only/evidence/compare.mjs \
  plans/tailwind-only/evidence/reference-10 \
  plans/tailwind-only/evidence/after-10 \
  --out plans/tailwind-only/evidence/diffs-10
```

Run the embed integration command above and review/fix every image difference.
For home at 1024px, use `NODE_OPTIONS='--max-old-space-size=8192
--import=./plans/tailwind-only/evidence/capture-10-medium.mjs'` with
`serve-capture.mjs --only home --modes medium` and a separate output directory.
This extra viewport has no baseline and needs visual inspection. The wrapper
stops only its own server PID.

Static baseline cannot cover live agents/settings, Tests execution, unavailable
source errors or populated developer-only home issues. Those remain explicit
interactive/dev coverage gaps, as in the baseline plan. No dependency install
or unrelated repair was attempted.

### Integration pass — 2026-10-25

Final rebuild and complete 104-image capture finished under the shared lock.
**100 images match exactly**; all four remaining differences are the 37-pixel
Source changed-line inset edge already removed to obey AGENTS.md. These are
intentional non-AA differences, not strict pixel parity. Zero browser errors.

Fixed Events font shorthand/line-height, Embed state margins and code font,
Markdown's narrow display, Settings medium/narrow precedence and native selected
navigation appearance. `SettingsRow.viewport` owns viewport preset padding at
all widths; `ViewportsSection` consumes it instead of competing class fallthrough.
Final Settings recapture matches all 12 references. E12 requires focused important
utilities for native code font, state margins and narrow button padding; removed
conflicting important navigation declarations only to restore baseline behavior.
No general `!` cleanup and no CSS exception or tests added.

Vue suite: 155 files / 774 tests pass. Histoire: 404 files / 2,083 tests pass after
`vite build --emptyOutDir` removed stale chunks. All 99 retained bundle files were
byte-identical. Broad gates, file manifest, remaining static-only limits and the
Source reference-policy conflict are in
[integration report](evidence/after-10/report.md).

Integration gate result: embed 85 passed / 10 failed initially, with the extra
startup-navigation failure cleared by a 3/3 content-sizing file rerun; effective
remaining failures match all nine slice 05 baselines. Tailwind: 8 passed / 6
failed, exact slice 05 failure set. Cypress result is in the integration report.

Cypress integration: all 40 specs pass, 155 tests pass / 5 pending / zero
failures, using the documented XDG workaround and installed npm CLI through
a temporary PATH launcher. No dependency installation or user-server changes.
