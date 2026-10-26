# Slices 02/03 verification

Implemented together, uncommitted. Source and targeted checks are complete; strict pixel acceptance remains open for five baseline reference-state differences. Baseline files were not changed.

## Delivered

- Package-local Tailwind 4.3.3, CSS-first themes, no preflight. All 21 existing
  utility-based Vue files use `htw:`; marker classes stay on their elements.
- Both CSS build paths use PostCSS, scoped peer roots, global native property
  registrations. E12 removes universal fallback resets and unwraps generated
  layers to retain specificity against unlayered host preflight and v3 compilers.
- Existing public theme tokens, v3 palette values, radii and font assets remain.
  The app source-dev entry and aliases use built CSS. Standalone and peer color
  fallbacks work without host theme variables.
- Root Tailwind/PostCSS config and catalog remain v3. Controls stories own their
  small v3 config; Vue3 owns the former app v3 token configuration unchanged.
- Existing 136 app style blocks remain; no component CSS conversion in this track.

## Validation

- Controls: 24 files / 90 tests pass. Vue: 155 files / 773 tests pass.
- Histoire final clean-artifact run: 404 files pass, 1 skipped; 2,083 tests pass,
  2 skipped (final retry uses four workers after an unrelated worker exit).
  Bundle duplicate guard passes after clearing stale generated chunks.
- New/expanded checks: isolated defaults, every theme mapping, actual v3 CSS
  consumption, readable packaged fonts and source-dev style paths. In-memory
  faults removing isolation and a theme entry trigger the expected failures.
- Final focused browser integration: content sizing, scoped embeds, Nuxt host
  channels/startup, source HMR and native controls: 8 files / 19 tests pass.
- Final Tailwind integration: same baseline 2 failed files / 6 failed tests,
  3 passed files / 8 passed tests. No test expectations changed.
- Vite app bundle, standalone/peer CSS, Vue3 static book (44 stories / 1,098
  variants), Nuxt UI static book and controls book (17 stories / 32 variants) pass.
- Lint: 0 errors, 39 existing warnings. Diff whitespace check passes.

Full package builds still stop in baseline vendor declaration errors after
emitting assets: controls `Module '"@iconify/vue"' has no exported member 'Icon'`;
app `Module '"vue"' has no exported member 'createApp'`. Requested root vue-tsc
command reports `Command "vue-tsc" not found`; installed controls binary runs
the workbench project but reports baseline missing Vue exports. Peer typecheck and declaration generation
pass after excluding example-only story fixtures from declarations.

Cypress remains blocked by `EROFS: read-only file system, open
'/home/akryum/.config/Cypress/cy/production/cache'`. Packed-consumer tests invoke
`pnpm install --prefer-offline` internally and failed; they were not rerun under
the no-install rule. No install command was invoked directly. Emitted CSS/font
paths have separate artifact checks; this is not installed-consumer proof.

Full embed rerun: 44 files / 84 tests pass; four files / nine tests fail.
All nine failures belong to existing baseline visual-regression, visual-recovery,
visual-transport and Vue-host-isolation failures. Focused final checks after the
last CSS cascade change pass all 19 tests across eight affected files.

Exact commands, intermediate failures and final results: command ledger
and logs. Initial compiler/packaging defects are retained as red
checks, followed by passing rechecks. Initial full embed run preceded artifact repairs; the full rerun and final
focused checks are separate evidence, not interchangeable green-gate claims.

## Visual evidence

104/104 normal captures completed without browser errors. Final ordinary narrow
recapture included in the manifest. **99/104 PNGs match exactly**. Pixelmatch uses
threshold 0.1 and includes anti-aliasing. Comparison,
[visual summary](../visual-summary-03.json), [manifest](manifest.json).

Five references remain different:

- `canvas-matrix-light` and `canvas-matrix-dark`: baseline uses fallback fonts.
  Blocking font requests reproduces each entire baseline image exactly.
- `plugin-inspector-light`, `plugin-inspector-dark`, `plugin-inspector-compact`:
  baseline shares that fallback heading raster. A fixed heading crop is byte-
  identical to the Matrix fallback and differs from the canonical Grid heading.
  Blocking fonts reproduces chrome; 1,822 / 1,841 canvas-region pixels still
  differ, consistent with mixed font/layout state. These three references need
  review; exact full-image parity is **not** claimed.

Font experiment and
[heading-region hashes](../font-region-hashes.json) retain the evidence.
Diagnostics used copies of the original capture tooling under `/tmp`, with
font requests aborted and rejected font loads tolerated. Product source and
normal capture recipes were unchanged. The mixed-font experiment is diagnostic
only, not a replacement acceptance image.

One initial Nuxt narrow capture differed because the header was hidden in the
reference. Three ordinary same-build repeats yielded two exact matches and one
1,045-pixel header difference. Final ordinary recapture matched; see
[narrow repeats](../narrow-repeat-comparison.json). No CSS or app state was
injected for those repeats.

Real Chromium CSS probe passes v3/v4 transform/ring/shadow preservation in both
stylesheet orders, embedded dark, alpha multiplication, peer-only spacing,
standalone palette defaults and specificity against an unlayered host reset.
[Probe output](probe-v4.json), [probe source](../probe-v4.mjs).

Static-only coverage boundaries from [baseline](../../baseline.md) still apply.
No standalone-controls baseline existed; controls book build and isolated CSS
probes do not substitute for a before/after standalone gallery. All preview
servers were stopped by their recorded owned PIDs; ports 6006/6106 were unused.

## CSS sizes

[Exact bytes, gzip sizes and hashes](../css-sizes-03.json):

- Bundled app: 198,045 to 196,584 bytes (-0.74%); gzip 31,130 to 30,992.
- App stylesheet: 104,082 to 115,517 (+10.99%); gzip 14,505 to 13,896.
- Standalone controls: 27,384 to 28,100 (+2.61%); gzip 4,852 to 4,801.
- Peer controls: 33,074 to 33,924 (+2.57%); gzip 5,514 to 5,638.

App stylesheet raw growth comes from v4 native property/nesting output and
preserved imported component CSS. It is not a static whole-palette emission;
only used theme variables are emitted. Gzip is smaller than baseline.

## Files

[Machine-readable source/plan manifest](../files-02-03.json). Preinstalled
package dependencies, pnpm lockfile, baseline images, slice 01 files and `.claude/`
were preserved. No staging, commits, branches, stashes or process-by-port kills.

### Created

- `packages/histoire-app/src/app/style/main.css`
- `packages/histoire-app/src/app/style/theme.css`
- `packages/histoire-controls/scripts/flatten-tailwind-layers.cjs`
- `packages/histoire-controls/scripts/generate-peer-theme.mjs`
- `packages/histoire-controls/scripts/postcss-tailwind-isolation.cjs`
- `packages/histoire-controls/src/style/base-theme.css`
- `packages/histoire-controls/src/style/compile-styles.test-support.mjs`
- `packages/histoire-controls/src/style/peer-theme.css`
- `packages/histoire-controls/src/style/tailwind-assets.spec.ts`
- `packages/histoire-controls/src/style/tailwind-theme.spec.ts`
- `packages/histoire-controls/src/style/tailwind-workspace.spec.ts`
- `packages/histoire-controls/src/style/theme.css`
- `scripts/build-tailwind.mjs`

### Changed

- `examples/vue3/tailwind.config.cjs`
- `packages/histoire-app/package.json`
- `packages/histoire-app/postcss-scope-wrapper.cjs`
- `packages/histoire-app/postcss.config.cjs`
- `packages/histoire-app/src/app/components/base/BaseKeyboardShortcut.vue`
- `packages/histoire-app/src/app/components/command/CommandPrompts.vue`
- `packages/histoire-app/src/app/components/command/PromptSelect.vue`
- `packages/histoire-app/src/app/components/command/PromptText.vue`
- `packages/histoire-app/src/app/components/story/StoryVariantGridSandbox.vue`
- `packages/histoire-app/src/app/components/story/StoryVariantGridSandboxItem.vue`
- `packages/histoire-app/src/app/components/toolbar/ToolbarNewTab.vue`
- `packages/histoire-app/src/app/style/README.md`
- `packages/histoire-app/src/bundle-main-dev.js`
- `packages/histoire-controls-stories/histoire-setup.ts`
- `packages/histoire-controls-stories/tailwind.config.cjs`
- `packages/histoire-controls/package.json`
- `packages/histoire-controls/postcss.config.cjs`
- `packages/histoire-controls/postcss.peer.config.cjs`
- `packages/histoire-controls/src/components/HstCopyIcon.vue`
- `packages/histoire-controls/src/components/button/HstButton.story.vue`
- `packages/histoire-controls/src/components/design-tokens/HstColorShades.story.vue`
- `packages/histoire-controls/src/components/design-tokens/HstColorShades.vue`
- `packages/histoire-controls/src/components/design-tokens/HstTokenDetails.vue`
- `packages/histoire-controls/src/components/design-tokens/HstTokenGrid.story.vue`
- `packages/histoire-controls/src/components/design-tokens/HstTokenGrid.vue`
- `packages/histoire-controls/src/components/design-tokens/HstTokenList.story.vue`
- `packages/histoire-controls/src/components/design-tokens/HstTokenList.vue`
- `packages/histoire-controls/src/components/json/HstJson.vue`
- `packages/histoire-controls/src/components/json/HstJsonEditor.vue`
- `packages/histoire-controls/src/components/number/HstNumber.vue`
- `packages/histoire-controls/src/components/select/HstSelect.story.vue`
- `packages/histoire-controls/src/components/slider/HstSlider.vue`
- `packages/histoire-controls/src/style/main.css`
- `packages/histoire-controls/src/style/peer.css`
- `packages/histoire-controls/src/style/tailwind-defaults.spec.ts`
- `packages/histoire-controls/tsconfig.json`
- `packages/histoire/src/node/__tests__/sandbox-html.spec.ts`
- `packages/histoire/src/node/alias.ts`
- `plans/tailwind-only/02-controls-v4.md`
- `plans/tailwind-only/03-app-v4.md`
- `plans/tailwind-only/README.md`
- `plans/tailwind-only/architecture.md`
- `plans/tailwind-only/exceptions.md`
- `plans/tailwind-only/inventory.md`
- `plans/tailwind-only/validation.md`

### Deleted

- `packages/histoire-app/src/app/style/main.pcss`
- `packages/histoire-app/tailwind.config.cjs`
- `packages/histoire-controls/scripts/peer-style.mjs`
- `packages/histoire-controls/tailwind.config.cjs`
- `packages/histoire-controls/tailwind.peer.config.cjs`

Created evidence: this report, source manifest, CSS sizes, browser probe, command logs, normal captures, comparison outputs, font diagnostics and repeated narrow captures. Baseline evidence was not overwritten.
