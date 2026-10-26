# 08 — Side panes

## Outcome and prerequisites

Depends on: 05 (pane layout, states). Stories, search, tests, visual, MCP and AI panes use utilities. Pane edges keep the AGENTS.md layout contract (gutter, row inset, header height, density row paddings through theme spacing).

## Owned files

[Inventory slice 08](inventory.md#slice-08): `components/panes/{stories,search,tests,visual,mcp,ai}/*`.

Order: stories → search → tests → mcp → ai → visual (largest, container-query heavy).

## Implementation steps

1. **Row paddings.** Each list uses its density token (`--histoire-story-row-padding`, `--histoire-test-row-padding`, `--histoire-mcp-row-padding`, …): `htw:py-row-story htw:px-pane-row-inset`. Never all four sides from one density token; never hard-coded 16/8.
2. **Search.** `SearchScopes` full-width button group → slice 04 `HstButtonGroup` prop. `SearchPanel` `.workbench-state` → `fill` prop.
3. **Tests.** `FunctionalTestsPanel` `.histoire-switch` → root fallthrough. `TestsTreeRow` `:deep(svg)` and status icon colors → icon props/classes at render site; status color maps as full class strings per status. Keep `tests-panel`, `test-row`, `test-story-heading`, `collection-progress` markers. The indeterminate progress bar is in `histoire-vue` (`tests.css`), not here.
4. **Visual.** `VisualViewer` targets its own children (`.viewer-actions`, `.viewer-dock`, `.viewer-float`) under container queries: name the viewer container (`htw:@container/viewer`) and put `htw:@max-[…]/viewer:` variants on the children themselves (`VisualViewerActions`, `VisualViewerDock`, `VisualViewerHeader` own their responsive rules). Grid stacking (`grid-area: 1/1`) → `htw:col-start-1 htw:row-start-1`. `VisualViewerDock` `.histoire-icon-button` size → arbitrary property. `VisualTestsPanel` `.histoire-select` → fallthrough. `VisualViewerHeader` data-state chains → data variants. Keep `capture-message`, `screenshot-setup`, `recent-capture`, `phase-*` markers.
5. **MCP activity.** `McpActivity` (26 rules): row layout, status tones → data attributes + `htw:data-[tone=…]:`.
6. **AI.** `AiThreadHeader` `:deep(button)` → classes on its own buttons or `HstButton` fallthrough.

## Failure paths

- Container names must be unique per component tree; nested viewers (dock inside viewer) use distinct names.
- Virtualized lists measure row height: padding changes alter scroll math. Compare long lists against baseline at both densities.

## Validation commands

Per [folder slice procedure](architecture.md#folder-slice-procedure-0510). Browser: each pane in light/dark/compact/375 px; tests pane running state; visual viewer at narrow and wide widths, slider, dock; MCP activity with entries; search with no results.

## Acceptance criteria

No `<style>` in owned folders; pane edges line up across tabs and densities as before.

## Non-goals

Pane behavior; `histoire-vue` test styles.

## Status

Source migration implemented locally. Serial integration completed final pane
reference checks; its current gate results supersede historical lock blockers below.

### Changes

- Removed all 31 pane `<style scoped>` blocks. No component CSS files added.
- Stories/search/tests/MCP/AI/visual panes now use literal Tailwind v4 classes,
  existing theme spacing, native control hooks, and explicit state variants.
- Preserved the inventory markers on their original elements, including
  `stories-row`, `stories-group`, `stories-label`, and `image-scroll`.
- Search scopes use `HstButtonGroup.block`; state content uses `fill` and local
  margins. Test status colors live on icons; busy indicators stay neutral.
- Viewer owns named `@container/viewer`; header, dock and actions own their
  responsive rules. Layer images share grid row/column 1. Native range/progress
  pseudo-elements use literal arbitrary variants.
- Added `VisualViewerSurface.vue` for shared floating surfaces and
  `VisualViewerDockButton.vue` for repeated dock actions. Neither adds a DOM wrapper.
- AI header slot actions receive their own muted classes.

### Files

Changed under `packages/histoire-app/src/app/components/panes/`:

- `stories/StoriesPanel.vue`
- `search/{SearchPanel,SearchResultItem,SearchScopes}.vue`
- `tests/{FunctionalTestsPanel,TestsPanel,TestsSummary,TestsTree,TestsTreeRow}.vue`
- `mcp/{McpActivity,McpClients,McpContent,McpCurrentOperation,McpEndpoint,McpHistory}.vue`
- `ai/{AiCreatedStories,AiPanel,AiThreadComposer,AiThreadHeader,AiThreadList,AiThreadView}.vue`
- `visual/{VisualImageLabel,VisualResultRow,VisualResultsList,VisualSlider,VisualTestsPanel,VisualTestsSummary,VisualViewer,VisualViewerActions,VisualViewerDock,VisualViewerHeader}.vue`

Created: `visual/{VisualViewerSurface,VisualViewerDockButton}.vue`, this status,
`evidence/after-08/`, `evidence/after-08-initial/`, `evidence/diffs-08/`,
`evidence/logs/08/` and validation receipts. No source files deleted. No shared
component, theme, package-hook or shared-plan edits. Pre-existing changes retained.

### Deviations and exceptions

- No custom-CSS exceptions added. E12 still applies: provider-qualified native
  button defaults outrank single-class utilities. Layout/spacing utilities use
  `!` on native buttons where no hook exposes the declaration. Search focus reset,
  local state margins, active search rows, floating button backgrounds, MCP heading
  reset and hidden result actions also require targeted `!` modifiers. Existing
  package-owned story selection appearance is retained.
- Actual test rows have nested 42px start / 10px end indentation; retained rather
  than flattening them to generic pane inset. Virtual-row heights and MCP's
  already-inset zero-horizontal-padding rows retained. Story depth now adds to
  `--histoire-pane-row-inset` instead of hard-coding its 8px default.
- Empty catalog now uses `WorkbenchEmptyState`, as required by AGENTS.md.
- No behavior tests added: conversion changes presentation only; existing
  navigation, search and native component suites provide behavior coverage.

### Validation

- All builds, suites and browser sessions use `flock /tmp/histoire-tailwind.lock`.
  Installed Node 24.16.0 and cached pnpm 10.33.0 used; no dependency installation.
- Scoped ESLint, `git diff --check`, marker retention scan, and zero-style/deep/apply
  scan pass. Largest owned Vue files remain below 300 lines.
- `pnpm --filter @histoire/app build`: initial attempt encountered concurrent
  comments syntax errors; retry reached inherited embed declaration failures:
  `Module '"vue"' has no exported member 'createApp'`. Vite itself passes.
- `pnpm --filter @histoire/app exec vite build`, `build:css`, and app's
  `node scripts/copy.mjs`: pass. Static Vue3 story build passes.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter @histoire/vue test`:
  retry passes **155 files / 774 tests**. Initial run had four concurrent
  comments/inspector compilation failures; 746 tests passed then.
- Root `pnpm exec vue-tsc --noEmit -p packages/histoire-app/tsconfig.workbench.json`:
  `Command "vue-tsc" not found`. Direct installed vue-tsc invocation with 8GB heap
  runs but reports existing vendor Vue resolution failures and their cascades.

### Screenshots and remaining gates

Initial captures exposed native button specificity overriding search-row padding
and the search input focus reset. Those were corrected. Story selection was
restored to the baseline's package-owned appearance. Initial diagnostic images
and comparison remain in `evidence/after-08-initial/`.

- Initial snapshot: 12/12 screenshots captured without browser errors, using
  baseline references for Stories, Search results and empty Search in light,
  dark, compact and 375px modes. Initial full-image differences range from
  0.3110% to 2.8709%; these include own spacing/focus/selection issues and
  concurrent canvas/inspector changes outside this track. This is diagnostic
  evidence, not final parity proof. `evidence/diffs-08/summary.json` describes
  the initial snapshot; latest source refinements have not been recaptured.
- Final rebuild/capture attempts and queued embed/Tailwind/example test commands
  could not acquire `/tmp/histoire-tailwind.lock`. Two waiting commands exited
  143 before starting; six bounded 45-second lock retries exited 1. No process
  owned by another track was stopped, and the lock was never bypassed.
- `test:embed:integration`, `test:tailwind:integration`, and `test:examples`
  therefore have **no new result** for this slice. Re-run those gates and the
  final capture after the lock owner finishes. Capture recipe:
  `flock /tmp/histoire-tailwind.lock bash /tmp/histoire-08-capture-final.sh`
  (temporary session script); persistent tooling invocation:
  `node plans/tailwind-only/evidence/serve-capture.mjs --out plans/tailwind-only/evidence/after-08 --port 4612 --only '{stories,search-*}'`.
  Build Vite, `build:css`, copy assets, and build `examples/vue3` first, all
  within the lock. Compare full images and the owned pane region separately
  while parallel tracks are changing canvas/inspector pixels.
- Static-only baseline cannot exercise Tests/running tree, visual
  review/slider/dock, MCP activity or AI threads. No fake runtime data or dev
  server introduced. Those require orchestrator live-runtime verification.
- Reserved ports 6006/6106 were not used. The completed capture wrapper started
  and stopped its own server PID 372 on 4612. No owned server remains running.
- `evidence/files-08.json` gives exact source file ownership. Raw commands and
  results: `evidence/logs/08/`. `after-08-initial/` retains diagnostic captures.

Remaining for orchestrator: final source rebuild and recapture, regional/full
image comparison with concurrent changes accounted for, three broad integration
commands, and unavailable dev-only surfaces. Existing vendor declarations and
missing root vue-tsc remain independent validation blockers. No commits or
staging performed.

### Integration pass — 2026-10-25

Final Stories and both Search states match all four reference modes exactly.
Fixed `StoriesPanel`: important horizontal padding had overridden inline tree
depth. Apply the existing important padding only to the logical end; inline start
padding again owns indentation. No marker changed and no new important modifier.
No other pane source changed. Full 104-image comparison has only four unrelated
Source-edge differences; Vue 155 files / 774 tests and Histoire 404 files / 2,083
tests pass. Broad gate results and commands:
[integration report](evidence/after-10/report.md). Static-only pane limitations
remain. No custom-CSS exception or tests added.

Integration gate result: embed 85 passed / 10 failed initially, with the extra
startup-navigation failure cleared by a 3/3 content-sizing file rerun; effective
remaining failures match all nine slice 05 baselines. Tailwind: 8 passed / 6
failed, exact slice 05 failure set. Cypress result is in the integration report.

Cypress integration: all 40 specs pass, 155 tests pass / 5 pending / zero
failures, using the documented XDG workaround and installed npm CLI through
a temporary PATH launcher. No dependency installation or user-server changes.
