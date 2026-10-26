# 07 — Canvas matrix and toolbar

## Outcome and prerequisites

Depends on: 06 (viewport variables, frame props) and 05 (toolbar presentation composable). Matrix view, axis bar/form, matrix inspector, canvas toolbar, toolbar buttons and popovers use utilities. Overflow menu presentation handled by the items themselves.

## Owned files

[Inventory slice 07](inventory.md#slice-07): `components/canvas/matrix/*` (incl. `matrix-axis-form.css`), `components/canvas/toolbar/*`.

Order: `ToolbarButton`, `ToolbarPopover`, toolbar labels/values → `CanvasToolbar`, `ToolSwitch`, `ArrangeSwitch` → popovers (`ScreenshotPopover`, `ViewportMenu`, `ZoomMenu`) → matrix axis form/bar/entry → `MatrixInspector` → `MatrixView`.

## Implementation steps

1. **Toolbar presentation.** Consume `useToolbarPresentation()` from slice 05 in `ToolbarButton`, labels, shortcut/value spans, menu-only items and the search stepper; switch their own classes for `menu` vs `inline`. Then delete the remaining `:deep` rules in `BaseOverflowToolbarItem` (slice 05 left them for this).
2. **Icon sizes.** `ToolbarButton` sets `--histoire-icon-button-size` and `:deep(svg)`: arbitrary property on the `HstButton` + icon size prop. `ScreenshotPopover` `:deep(svg)` same.
3. **`!important` in `ViewportMenu`, `ZoomMenu`.** Find what they override (likely popover/menu defaults from slice 05 components). Remove the need through a prop on the base component; utilities with `!` (`htw:w-60!`) only if the override targets package CSS that cannot get a hook.
4. **`CanvasToolbar`** `:deep(.overflow-toolbar-item[data-toolbar-presentation="inline"] .histoire-tool-switch--leading)` → `ToolSwitch` reads presentation and a `leading` prop.
5. **Matrix axis form.** `matrix-axis-form.css` overrides `--histoire-control-*` variables for compact controls: arbitrary properties on the form root (`htw:[--histoire-control-height:28px]`), or a `size="sm"` on controls if slice 04 added one. Delete the file.
6. **Selects.** `MatrixAxisBar`, `MatrixInspector` style `.histoire-select`: root fallthrough (slice 04 table).
7. **`MatrixView`.** Uses viewport variables from 06 in `calc()`; `:deep(.histoire-matrix-cell)` → props on the cell component; `.workbench-state` → `fill` prop (05). Keep `histoire-matrix-*` markers. Container query in `MatrixAxisBar` → named container.

## Failure paths

- Overflow measurement: `BaseOverflowToolbar` measures item widths; changing inline item padding/gaps changes when items overflow. Compare overflow breakpoints at 1440, 1024, 768, 375 against baseline.

## Validation commands

Per [folder slice procedure](architecture.md#folder-slice-procedure-0510) plus `pnpm run test:examples` (matrix Cypress specs). Browser: matrix with axes, axis editing, inspector, toolbar inline and overflow at all widths, screenshot popover, viewport and zoom menus.

## Acceptance criteria

No `<style>`/`.css` in owned folders; `BaseOverflowToolbarItem` has no `:deep`; overflow breakpoints unchanged.

## Non-goals

Toolbar behavior or item order changes.

## Status

Implemented 2026-10-25, uncommitted. Serial integration now verifies final
Matrix/toolbar references; see Integration pass below for current gates and limits.

### Landed

- Converted all 18 styled Matrix/toolbar SFCs to literal utilities and deleted
  `matrix/matrix-axis-form.css`. `MatrixAxisForm` and `MatrixAxisFormActions` share
  editor structure without class constants or a replacement stylesheet. The new
  axis form still exposes its native form element to existing focus/scroll logic.
- Buttons, popover anchors, tool/arrangement groups, search stepper and background
  swatch consume `useToolbarPresentation`. `ToolSwitch.leading` owns its inline
  inset. Label/value/shortcut visibility and menu geometry live with their owners.
- Removed the entire temporary E13 style block from
  `base/overflow/BaseOverflowToolbarItem.vue`; its registration, measurement,
  Teleport, wrappers and separators are unchanged. This is the only shared source
  component changed by Track A. `exceptions.md` marks E13 removed.
- Viewport menu uses existing flat-button tone via `PopoverRow` fallthrough;
  removed legacy important color/font-weight rules. Zoom cursor uses an ordinary
  utility. Icon dimensions use icon props; native iconOnly keeps square geometry.
- Matrix cells own pointer input and selected/focus outlines. Axis/root positions
  retain viewport variables, and inclusive named containers own summary visibility.
  Shared state callers own their former margins directly. Markers stay in place.
- No `@histoire/vue`, `@histoire/controls`, shared theme, shell, or menu source
  changes. Source/plan path manifest: `evidence/files-06-07.json`; final captures:
  `evidence/after-07` and supplemental `after-07-extras`.

### Deviations and exceptions

- E13 removed; no new custom CSS exception.
- E12 also exposes provider-scoped utility specificity. Important modifiers are
  limited to toolbar button geometry (including menu/group overrides), responsive
  summary hiding, axis-select minimum width, custom-axis/swatches' border color
  and dash style, textarea font hooks, and shared-state margin overrides where
  existing APIs do not remove the conflicting declaration. Icon size and button
  tone continue through their existing hooks. No blanket important mode added.
- Initial captures exposed larger toolbar padding, a visible narrow Matrix
  summary, and an Add axis border becoming solid. Corrections preserve original
  overflow width and dashed outline. All final tested canvas/matrix pixels match.
- Additional 1024/768 menu captures have no baseline counterpart. Existing
  measurement code is unchanged; 1440/375 reference captures match exactly within
  canvas, and real overflow interactions pass at the added widths.
- Static screenshot popover is unavailable; see the explicit validation boundary
  below. Source conversion is complete, but no visual claim is made for that
  dev-only surface.

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

Rebuilt final static assets and captured the complete 104-image matrix under the
shared lock. Canvas, Matrix and toolbar reference regions match exactly, with
zero browser errors. No additional slice 07 source changes; no `!` cleanup.
A transient Matrix network-idle timeout was retried successfully without changing
readiness checks. Vue tests pass 155 files / 774 tests and Histoire unit tests pass
404 files / 2,083 tests. Broad gate results, the four unrelated Source-edge
differences, and commands are in [integration report](evidence/after-10/report.md).
Static screenshot setup remains outside the available book coverage.

Integration gate result: embed 85 passed / 10 failed initially, with the extra
startup-navigation failure cleared by a 3/3 content-sizing file rerun; effective
remaining failures match all nine slice 05 baselines. Tailwind: 8 passed / 6
failed, exact slice 05 failure set. Cypress result is in the integration report.

Cypress integration: all 40 specs pass, 155 tests pass / 5 pending / zero
failures, using the documented XDG workaround and installed npm CLI through
a temporary PATH launcher. No dependency installation or user-server changes.
