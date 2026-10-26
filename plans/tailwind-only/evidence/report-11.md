# Slice 11 — globals, source guard, and important modifiers

Implemented and validated locally on 2026-10-25 within the baseline limits below.
No staging, commit, branch, installation, or reserved-port operation.

## Source result

- All **224 app Vue files** contain zero style blocks; app source contains zero
  deep selectors. **345 of 346 important occurrences** were removed from **67 app
  files**; one source-background override remains for Shiki inline styling.
- Eight CSS/PCSS files remain, exactly the source guard allowlist. No component
  stylesheet was added. `EmbedDocument.vue` contained the last style block.
- Native component selectors and peer scoping use zero-weight qualification.
  Font/color resets and native box sizing retain one class of specificity so
  ordinary host element resets cannot override them. Explicit tone props retain
  their pressed-state priority; disabled opacity permits hidden actions while
  disabled cursor styling retains state priority.
- Static `bundle-main.js` now loads bundled component defaults before utilities.
  The previous order undid E12's ordering across generated files.
- App-owned conflicts use explicit APIs: workbench state `flush`, `HomeRow.muted`,
  and fixed hover backgrounds. StoriesPanel and SettingsNav now explicitly render selected rows
  with the same neutral treatment previously imposed by native button CSS.

## Files and exceptions

- **Changed production files: 85.** Exact paths and before/after SHA-256 hashes:
  [files-11.json](files-11.json). Incremental source diff relative to this track's
  starting tree: changes-11.patch. Existing uncommitted work
  remains in place; the patch does not include earlier slices' changes.
- **Created test:** `packages/histoire/src/node/__tests__/app-styling-guard.spec.ts`
  (three structural checks). Its initial run failed on the actual remaining
  `EmbedDocument.vue` style block; final focused runs pass.
- **Created tooling:** [controls-11.mjs](controls-11.mjs), exercising real SSR
  controls and representative native panels without app utility overrides.
  Its original CSS inputs are retained in `controls-11/before-sources.json`.
  The existing comments fixture build now loads utility CSS last, matching the
  shipped static entry.
- **Documentation:** root `AGENTS.md`, app style README, slice 11 Status, and small
  updates to the plan index, architecture, inventory and exceptions. Evidence includes captures,
  comparisons, source/size receipts, logs, and this report.
- **Deleted source files: none.** Removed one style block.
- **Exception recorded:** E14 describes the existing temporary story-document
  sizing stylesheet; no new custom CSS was introduced. E3/E6/E7 are clarified.
  The Important modifiers table documents all remaining document, motion,
  intrinsic-size and received-theme priorities, including runtime style writes and three existing native/controls rules.

## Visual verification

**104/104 main comparisons, 16/16 comments comparisons, and 16/16 native
comparisons match.** The final full sweep uses the final source tree. One narrow
Nuxt UI capture showed a 1,045-pixel difference limited to header-text alignment;
recapturing the same build, without code changes, matched. The original full-run
log retains that difference, and the final comparison contains zero changed
pixels. An earlier narrow Search capture failed before app mount; isolated retry
against the same build passed.

Reference mapping and hashes are in
reference-11/sources.json: baseline images, except
five font-corrected images from `after-03` and four Source images from `after-10`.
Original reference directories are unchanged.
Final full comparison,
comments comparison.

Native comparison: **16/16 exact** with light/dark, normal/hover/focus, selected
accent/danger tones, native tree/source states, and competing host element
resets. Uses real shared controls rendered by Vue SSR; native panel markup is a
representative CSS fixture, not a session lifecycle test. System fallback font
is held constant in this fixture; full book captures verify Manrope.
Native summary.

Initial diagnostic captures exposed group/fieldset specificity and cross-file
stylesheet ordering. The final list reset had to yield to explicit Events margins;
Settings selection retains its prior neutral colors. Shiki's inline background
requires the sole retained important utility. Expanded native captures exposed tone priority and host
reset leakage; both were repaired at source. Interrupted diagnostic runs are
not counted as accepted captures. No reference image was rewritten.

## Commands and results

Builds, package suites, story builds and browser sessions used
`flock /tmp/histoire-tailwind.lock`. Final comparisons run under the same lock.
Node/pnpm use existing `/tmp/histoire-integration-bin` launchers; Vitest and
vue-tsc use `NODE_OPTIONS=--max-old-space-size=8192`. Logs:
logs/11.

- `pnpm --filter @histoire/controls build`: reaches inherited declaration errors,
  e.g. `Module '"vue"' has no exported member 'ref'`.
- `pnpm --filter @histoire/app build`: reaches inherited embed declaration errors,
  e.g. `Module '"vue"' has no exported member 'createApp'`.
- Separate controls Vite/CSS/peer builds; native style copy; app Vite (clean
  bundled output), Vite embed, CSS and copy: **pass**. An early CSS attempt after
  the failed full controls build lacked peer output (`no valid target file was
  found`); explicit peer builds restored it, and later builds pass.
- Final `pnpm --filter @histoire/controls test`: **24 files / 90 tests pass**.
- Final `pnpm --filter @histoire/vue test`: **155 files / 774 tests pass**.
  One refresh failed an existing jsdom dynamic-list focus assertion; immediate
  full rerun passed without source changes.
- Final `pnpm --filter histoire test`: **405 files / 2,086 tests pass**;
  one file / two tests skipped by existing configuration.
- `pnpm --filter histoire test:embed:integration`: final full run **78 pass /
  17 fail**. Nine failures match baseline; eight additional cases failed during
  server binding (`listen EADDRINUSE` / `listen EACCES ...127.0.0.1:1`). A fresh
  process reran all five affected files: **13/13 pass**. Remaining reproducible
  failures are the same nine baseline cases; no new unresolved failure identity.
  An earlier full run had 85 pass / 10 fail, with its extra dropdown-reopen case
  passing an isolated rerun. [Final failure comparison](failures-final-11.json),
  [earlier comparison](failures-11.json).
- `pnpm --filter histoire test:tailwind:integration`: **8 pass / 6 fail**;
  failure identities exactly match the baseline.
- `pnpm run test:examples`: **40 specs / 155 tests pass / 5 pending**. A second full run also passes all 40 specs / 155 tests, with 5 existing
  pending tests; final targeted run covers the last Events/Settings/Source corrections: **3 specs / 21 tests pass**. Existing retry configuration handled transient attempts. XDG config/runtime paths are under `/tmp/histoire-slice11/cypress`;
  existing `CYPRESS_CACHE_FOLDER` is retained.
- Root `pnpm exec vue-tsc ...`: `Command "vue-tsc" not found`. Running the installed
  controls-package binary against the workbench config reaches inherited Vue
  declaration failures (`Module '"vue"' has no exported member 'computed'`).
- Scoped ESLint: **pass**. Root lint excluding generated evidence retains the
  existing `05-shell-and-base.md:190` error: `More than 1 blank line not allowed`.
  Unrelated documentation was not edited. Initial unfiltered lint was interrupted.
- Source guard and final `git diff --check`: **pass**. All 66 inventoried marker
  names retain their original elements in changed templates. No imports of removed app
  stylesheets remain. Changed source files stay below 300 lines (largest: 290).

### Successful build and capture recipe

Each command below ran under the global lock; browser port was `4615`.
Vitest/vue-tsc used the 8 GiB Node heap setting described above.

```sh
pnpm --filter @histoire/controls build:css
pnpm --filter @histoire/controls exec vite build
pnpm --filter @histoire/controls exec vite build --config vite.peer.config.ts
pnpm --filter @histoire/controls build:peer:css
pnpm --filter @histoire/vue exec node scripts/copy-styles.mjs
pnpm --filter @histoire/app exec vite build --emptyOutDir
pnpm --filter @histoire/app exec vite build --config vite.embed.config.ts
pnpm --filter @histoire/app build:css
pnpm --filter @histoire/app exec node scripts/copy.mjs
pnpm -C examples/vue3 story:build
pnpm -C examples/nuxt-ui story:build
node plans/tailwind-only/evidence/controls-11.mjs
node plans/tailwind-only/evidence/comments-09/build.mjs
```

Main captures use `evidence/serve-capture.mjs --out <directory> --port 4615`
with default Vue3 project, then `--project nuxt-ui` into the same directory.
Comments captures preload `evidence/comments-09/capture.mjs` through Node's
`--import` and select `--only 'comments-*'`. Comparisons use
`evidence/compare.mjs <reference> <capture> --out <diff-directory>`.
All paths are relative to `plans/tailwind-only/` in this paragraph.

## Remaining boundaries

Packed installed-consumer checks were not run because they install dependencies.
No claims of complete type/declaration builds or green broad integration gates.
App CSS totals **267,547 bytes**, down from **269,418 bytes** at integration 10
(0.69% smaller); CSS exports resolve. [CSS receipts](css-sizes-11.json).

Static books do not exercise live AI/MCP sessions, active screenshot setup,
running tests, populated visual-review docks, or every source error. Existing
behavior suites and native/comment fixtures supplement those limited captures;
they do not replace live-service qualification. Browser servers are owned by
capture/test processes; ports 6006 and 6106 were not used.
