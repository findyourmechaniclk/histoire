# 06 — Canvas core, overlays, tools and views

## Outcome and prerequisites

Depends on: 05. Canvas viewport, frames, single variant, header/status/measure hints, resize handles, overlays, tools and plugin views use utilities. Canvas marker classes (most-tested part of the UI) survive.

## Owned files

[Inventory slice 06](inventory.md#slice-06): `components/canvas/*.vue` (top level), `canvas/overlays/*`, `canvas/tools/*`, `canvas/views/*`. Not `canvas/matrix`, `canvas/toolbar` (07).

Order: `CanvasFrame` → `FrameGrid` → `CanvasSingleVariant`, `SingleVariantResizeHandles` → `CanvasHeader`, `CanvasStatus`, `CanvasMeasureHint`, `CanvasInfo*` → overlays, tools, views → `CanvasViewport` last (it defines local variables others read).

## Tests first

None expected. Marker classes are guarded by existing suites (`canvas-overlay-geometry.spec.ts`, `embed/integration/canvas-content-sizing.spec.ts`, `examples/vue3/cypress`); run them.

## Implementation steps

1. **`CanvasFrame` states.** Today `.is-selected`, `.is-highlighted`, `.is-dimmed` with chains like `.histoire-canvas-frame:not(.is-selected):not(.is-highlighted) .histoire-frame-label:enabled:hover`. Add `data-selected`, `data-highlighted`, `data-dimmed` attributes; frame root is `htw:group/frame`; children use `htw:group-data-[selected=false]/frame:…` and `htw:not-group-data-[highlighted=true]/frame:hover:…`. Keep `is-selected` as marker (tests use `.histoire-canvas-frame.is-selected`). Keep `histoire-frame-content`, `-title`, `-label`, `-select`.
2. **Viewport local variables.** `CanvasViewport` defines `--histoire-canvas-inspector-reserve` and `--histoire-canvas-info-inset`, read in `calc()` by `CanvasStatus`, `MatrixView` (07) and itself. Set them with `:style` (computed from props) or arbitrary properties on the viewport root; consumers use `htw:bottom-[calc(var(--histoire-canvas-info-inset)+8px)]`. Keep names (slice 07 depends on them). `:deep(.histoire-canvas-frame)` and `:deep(iframe)` from viewport/grid → frame props (`dragging`, `interactive`) owned by `CanvasFrame`.
3. **Container queries.** `CanvasHeader`, `CanvasStatus` (`span:nth-child(n+4)` hidden under a width), `CanvasMeasureHint`: `htw:@container/canvas-status` + `htw:@max-[480px]/canvas-status:[&>span:nth-child(n+4)]:hidden` or, better, mark the collapsible spans with a prop/flag and use `htw:@max-[480px]/canvas-status:hidden` on them directly.
4. **Status hints.** `CanvasStatus` styles slot/rendered `kbd` and `.canvas-hint-title` via `:deep`: style at the render site (component that renders hints) or a `CanvasHint` component.
5. **Resize handles.** Keyboard-input state on parent (`[data-keyboard-input="true"] .handle:focus-visible`) → `htw:group/handles` + `htw:group-data-[keyboard-input=true]/handles:focus-visible:…`. `color-mix()` → opacity modifiers.
6. **Measure hint.** `scrollbar-width: none` → `htw:[scrollbar-width:none]`.
7. **Overlays.** `OverlayItem` pointer-events logic → `HistoireExtensionView` `interactive` prop (slice 04); positioning → `classes.root`/`classes.mount` parts. `PluginCanvasView` `:deep(.histoire-extension-mount)` → same parts.
8. **Single variant iframe.** `CanvasSingleVariant` `:deep(iframe)`: the iframe is created by the frame/replica component; give it a class there or a prop. Do not use descendant variants unless the iframe is created outside Vue (then rule 7).
9. **Reduced motion.** `CanvasViewport` media query → `htw:motion-reduce:`.

## Failure paths

- Canvas performance: thousands of frames re-render on hover/selection. Group variants are CSS-only; do not compute class strings per frame from reactive state that was not already reactive.
- Selection tests read `.is-selected`: keep it in the `:class` binding even though styling uses `data-selected`.

## Validation commands

Per [folder slice procedure](architecture.md#folder-slice-procedure-0510) plus `pnpm --filter histoire test:embed:integration` and `pnpm run test:examples`. Browser: grid/list/single, selection, highlight, dimming, frame label hover, resize handles with keyboard, measure hints, status at narrow width, plugin overlays and custom view (`examples/plugin-reference`).

## Acceptance criteria

No `<style>` in owned files; canvas suites and Cypress green; matrix rows unchanged.

## Non-goals

Matrix and toolbar (07); canvas behavior changes.

## Status

Implemented 2026-10-25, uncommitted. Serial integration now verifies final
canvas references; see Integration pass below for current gates and limits.

### Landed

- Converted all 22 originally styled core/overlay/tool/view SFCs to literal
  utilities. Selection, highlight, dimming and stale state use frame data variants;
  `is-selected` and every required marker remain on their original DOM elements.
- `CanvasFrame.dragging` forwards resize pointer suspension to
  `CanvasReplicaPreview.interactive`. Runtime-created iframe descendants are styled
  at their owned mount; the viewport's named pan group covers ordinary, Matrix and
  plugin replicas. No frame lifetime or selection logic changed.
- Preserved `--histoire-canvas-inspector-reserve` and
  `--histoire-canvas-info-inset`; viewport/header/status use named containment,
  logical positioning and reduced-motion utilities.
- Added `CanvasHintBar`, `CanvasHintItem`, `CanvasHintKey`, `CanvasHintButton`
  and `SingleVariantResizeHandle` for repeated markup/geometry. Resize feedback uses
  currentColor and semantic opacity utilities. Native grip semantics/focus remain.
- Overlay and custom-view layout use existing extension `classes.root/mount` and
  `interactive` hooks. No package hook, theme or shared shell changes needed.
- Source/plan created/changed/deleted path manifest: `evidence/files-06-07.json`.
  Final core captures (32, including Matrix coupling and search highlighting) are
  in `evidence/after-06`; original diagnostic set is `after-06-initial`.

### Deviations and exceptions

- Actual hint/file breakpoints are 650/640 px, not the draft's illustrative 480 px.
  Inclusive named container variants preserve existing boundaries.
- Locked measurement's Shift-hover hint remains visible at narrow widths: the
  old descendant cascade outranked its hide rule, and the reference shows it.
  The initial conversion hid it; final correction restores reference behavior
  instead of introducing a UI change in a styling slice.
- The imperative SDK creates the live iframe, so rule 7 descendant utilities on
  its owned mount replace the old cross-component iframe selectors.
- E12 requires limited important utilities for hint button spacing/radius and
  responsive hint/file visibility. Existing package/control defaults or provider
  utilities otherwise outrank these caller declarations. No custom CSS exception
  added; no component stylesheet retained.
- Initial captures caught extra rings on unselected frames and font shorthand
  resetting explicit line height/family. Both were fixed and recaptured.

### Validation and evidence

All builds, package suites, story builds and browser sessions used
`flock /tmp/histoire-tailwind.lock`; Vitest/vue-tsc used
`NODE_OPTIONS=--max-old-space-size=8192`. Installed Node 24.16.0 and the cached
pnpm executable bypassed the read-only mise shim. No dependency installation,
staging, commit, branch or user-server operation was performed.

- `pnpm --filter @histoire/app build`: app and embed Vite compilation pass;
  inherited embed declaration generation fails with `Module '"vue"' has no
  exported member 'createApp'`. One intermediate attempt encountered a concurrent
  comments-template syntax edit; retried after it settled, without changing it.
- Final `pnpm --filter @histoire/app exec vite build`, `pnpm --filter
  @histoire/app build:css`, asset copy via `node scripts/copy.mjs`, and
  `pnpm -C examples/vue3 story:build` pass. Static book: 44 stories / 1,098 variants.
- `pnpm --filter @histoire/vue test`: **155 files / 774 tests pass** on retry.
  Initial run encountered the same concurrent comments-template edit.
  Individual behavior files also pass: canvas overlay geometry 14/14, toolbar
  overflow 5/5, single resize 4/4. No new regression tests or style/class assertions.
- `pnpm --filter histoire test:embed:integration`: 43 files / 84 tests pass;
  6 files / 11 tests fail. Nine failures are the existing visual-regression,
  visual-recovery, visual-transport and native-host-isolation failures from slice
  05 (missing screenshot files, unavailable visual configuration, stack overflow).
  The two additional dev Matrix failures timed out locating `Zoom level` while
  the intermediate toolbar was too wide. After correcting geometry and rebuilding,
  targeted `matrix-custom.spec.ts` and `matrix-numeric.spec.ts` with `-t 'dev books'`
  both pass: 2/2, six unrelated cases skipped. The entire broad suite was not rerun.
- `pnpm run test:examples`: book builds, then the inherited Cypress config write
  fails: `EROFS: read-only file system, open '/home/akryum/.config/Cypress/cy/production/cache'`.
  Retried `pnpm -C examples/vue3 run ci-s` with `XDG_CONFIG_HOME` and
  `XDG_RUNTIME_DIR` under `/tmp/histoire-track-a/`, retaining the existing
  `CYPRESS_CACHE_FOLDER=/home/akryum/.cache/Cypress`: **all 40 specs pass,
  155 tests pass / 5 pending / zero failures**. User configuration unchanged.
- Root `pnpm exec vue-tsc --noEmit -p packages/histoire-app/tsconfig.workbench.json`
  fails with `Command "vue-tsc" not found`. The installed controls vue-tsc fallback
  runs and reports inherited Vue/vendor declaration failures; no clean typecheck
  claim. Scoped ESLint and `git diff --check` pass.
- Source guard: zero Vue style blocks, component CSS files or `:deep` rules in
  the converted canvas tree; maximum Vue file length **283**. The remaining
  `<style>` string in `snapshots/document.ts` serializes foreign runtime snapshots
  and was not changed.

Final reference comparison: **40 captures, no browser errors**. Baseline is used
except the two matrix light/dark font references, which come from `after-03`.
Neither reference directory changed. **All 43 tested canvas/matrix regions have
zero changed pixels**, including the Matrix inspector fields. Sixteen full-window
captures match exactly; the other 24 differ only inside Stories-pane variant rows
at x=103..240, y=461..593 depending on density. Those text/dot/selection differences
belong to concurrent Track B; no pane code was changed here. Full-window acceptance
therefore remains an orchestrator task, not a claim of a completely identical book.

Fourteen supplemental captures pass, with no browser errors: keyboard resize,
zoom popover, custom-axis creation/editing in light/dark/compact/narrow, plus
real overflow menus at 1024 and 768 px. Keyboard resize verifies +8 px and retained
focus; axis editing verifies saved values. These added states/widths have no original
reference images, so they prove working interactions and inspected layout, not
additional pixel parity. Initial zoom probe omitted shortcut text in its exact
text assertion; corrected to the accessible button-name prefix and recaptured.

Screenshot popover/setup remains **unverified visually**: `WorkbenchApp.vue`
compiles it out of static books. Initial unavailable-action probes are archived,
not counted as successful captures. No fake app state or dev server was introduced.
Packed installed-consumer suites were skipped under the no-install rule.

Evidence: `evidence/visual-summary-06-07.json`, `difference-bounds-06-07.json`,
`diffs-07-final/summary.json`, `regions-07-final/summary.json`,
`after-07-extras/{manifest,coverage}.json`, `guards-06-07.json`, and
`logs/06-07/`. All capture servers on port 4611 logged their matching PID stop;
reserved ports 6006/6106 were not used.

Aggregate CSS receipt: `evidence/css-sizes-06-07.json`. Bundled app.css:
23,055 bytes (4,465 gzip); standalone style.css: 245,737 bytes (31,566 gzip).
Compared with slice 05, declarations moved into utility output, so standalone CSS
increased while bundled CSS decreased sharply; combined raw output is about 15%
smaller. Concurrent tracks 08–10 contribute to these totals; this is not an isolated
Track A size claim.

### Integration pass — 2026-10-25

Serial integration rebuilt controls peer output, app Vite/CSS/assets, and both
static books. Full 104-image matrix has zero browser errors; all canvas regions
match their assigned references exactly. No additional slice 06 source changes.
The four remaining full-image differences are slice 10's forbidden Source edge,
37 pixels each. Vue tests pass 155 files / 774 tests; Histoire unit tests pass
404 files / 2,083 tests after removing stale generated chunks. Broad gates and
all command receipts are recorded in [integration report](evidence/after-10/report.md).
Existing static-only coverage limits remain; no new CSS exception or tests.

Integration gate result: embed 85 passed / 10 failed initially, with the extra
startup-navigation failure cleared by a 3/3 content-sizing file rerun; effective
remaining failures match all nine slice 05 baselines. Tailwind: 8 passed / 6
failed, exact slice 05 failure set. Cypress result is in the integration report.

Cypress integration: all 40 specs pass, 155 tests pass / 5 pending / zero
failures, using the documented XDG workaround and installed npm CLI through
a temporary PATH launcher. No dependency installation or user-server changes.
