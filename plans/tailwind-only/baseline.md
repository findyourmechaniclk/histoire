# Baseline — slice 01

Recorded 2026-10-25 on branch `main`, HEAD `acfebdf9`; plan pack commit `d3423251`. Initial `git status --short`: only `?? .claude/`. No app, controls or Vue source/style changes at entry. `.claude/` remains untouched. No staging, commits, branches, stashes or dependency installs.

## Scope and reproducibility

User override supersedes slice's old dev-server instructions: no server exists on 6006; ports 6006/6106 are reserved. Build static `examples/vue3`, then serve with `histoire preview` on 4610. Every package build, suite, example build and browser session runs under `flock /tmp/histoire-tailwind.lock`. Preview lifecycle belongs to `evidence/serve-capture.mjs`, which logs its own PID and stops only that process. Nuxt uses 4611.

Tooling: [evidence/README.md](evidence/README.md). Explicit screen identities, route queries and actions: [evidence/screens.mjs](evidence/screens.mjs), [evidence/capture-actions.mjs](evidence/capture-actions.mjs). Each capture has fresh storage, fixed story/variant, DPR 1, UTC/en-US, fixed wall time, reduced motion, disabled screenshot animations/caret, and waits for fonts/images and ready frames. Modes: `light`, `dark`, `compact` (1440×900), `narrow` (375×812). Compact is light; narrow uses comfortable density. Actual app settings drive appearance/density; no app source is changed to obtain screenshots.

Shell shim initially failed with `mise ERROR Read-only file system (os error 30)`. Prefixing `PATH=/home/akryum/.local/share/mise/installs/node/24.16.0/bin:$PATH` avoids that shim. Package-manager scripts can select their own installed Node runtime. `NODE_OPTIONS=--max-old-space-size=8192` is set for all suite/typecheck runs. No install was attempted.

## Build and validation

Initial root `pnpm run build` failed in `@histoire/shared`: `Module '"vue-router"' has no exported member 'RouteLocationNormalizedLoaded'`. Separate controls/app builds also failed in type generation after emitting JavaScript/CSS. These failures are preserved, not repaired in this slice. Remaining existing asset subcommands are run separately only to make the static book capture possible. This is partial-build evidence, never a claim that package builds passed.

After completing generated assets, controls pass 21 files / 82 tests; Vue passes 155 files / 773 tests; Histoire passes 404 files with one skipped file / 2,082 tests and two skipped tests. Initial import failures must not be mistaken for these effective recheck results. Full build/type gates remain separate.

| Gate | Effective result |
| --- | --- |
| Root, controls and app builds | Fail in type generation; root reports `Module '"vue-router"' has no exported member 'RouteLocationNormalizedLoaded'` |
| `pnpm --filter @histoire/controls test` | 21 files / 82 tests pass |
| `pnpm --filter @histoire/vue test` | 155 files / 773 tests pass |
| `pnpm --filter histoire test` | 404 files pass, 1 skipped; 2,082 tests pass, 2 skipped |
| `pnpm --filter histoire test:embed:integration` | 40 files pass, 8 fail; 80 tests pass, 13 fail |
| `pnpm --filter histoire test:tailwind:integration` | 3 files pass, 2 fail; 8 tests pass, 6 fail |
| Workbench typecheck | Requested root and app-package invocations cannot find `vue-tsc`; existing controls-package binary runs the requested workbench project and reports 1,309 type errors, beginning with missing Vue exports |
| `pnpm run test:examples` | Book builds; Cypress cannot start tests: `EROFS: read-only file system, open '/home/akryum/.config/Cypress/cy/production/cache'` |

The Cypress startup limitation is the allowed skip from the assignment; no dependency install or user-config write was attempted. Integration failure names are all retained below the linked log summaries, excluding intentionally failing nested story fixtures.

Complete chronological command ledger: results.tsv (name, exit code, elapsed seconds, command). Full output: logs. [Named failures](evidence/validation-failures.md) distinguish initial incomplete-artifact runs from post-asset rechecks. Root `pnpm exec vue-tsc ...` reports `Command "vue-tsc" not found`; no dependency was installed.

The following existing steps complete the JavaScript/CSS/font outputs that full builds skipped after declaration errors. They do not bypass or reclassify the failed full-build gates:

```bash
pnpm --filter @histoire/controls exec vite build --config vite.peer.config.ts
pnpm --filter @histoire/controls run build:peer:css
node packages/histoire-controls/scripts/copy-fonts.mjs
pnpm --filter @histoire/app run build:css
pnpm --filter @histoire/app exec node scripts/copy.mjs
```

All five succeed under the global lock. Subsequent `pnpm -C examples/vue3 story:build` succeeds (44 stories / 1,098 variants, four existing empty story files); `pnpm -C examples/nuxt-ui story:build` succeeds (2 stories / 22 variants). Their first attempts failed because `@histoire/app/dist/bundle-index.js` had not yet been copied by the interrupted app build.

`packages/histoire-app/vite.config.ts` aliases `@histoire/vue` and `@histoire/controls/vue` to their source entries, and app CSS imports native Vue source styles. The app bundle therefore reflects current UI source even though package declaration gates fail.

## CSS sizes

After completing existing asset steps, before any Tailwind migration. Gzip uses level 6 with no filename or timestamp. [Machine-readable sizes and SHA-256](evidence/css-sizes.json).

| File | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| `packages/histoire-app/dist/bundled/app.css` | 198045 | 31130 |
| `packages/histoire-app/dist/style.css` | 104082 | 14505 |
| `packages/histoire-controls/dist/style-standalone.css` | 27384 | 4852 |
| `packages/histoire-controls/dist/peer/style.css` | 33074 | 5514 |

## Screenshot recipes

Every row uses `light`, `dark`, `compact`, and `narrow` as defined above. Vue3 base is `http://127.0.0.1:4610/`; Nuxt UI base is `http://127.0.0.1:4611/_stories/`. Route paths below are relative to that base (leading slash replaces only the application route, not the Nuxt base). `serve-capture.mjs` applies these automatically.

| Screen filename stem | Route | Additional setup |
| --- | --- | --- |
| `home` | `/` | Wait for Browse |
| `canvas-grid` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=grid` | Wait for mounted content |
| `canvas-list` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=list` | Wait for mounted content |
| `canvas-single` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=single` | Wait for mounted content |
| `canvas-matrix` | `/story/src-components-workbenchmatrix-story-vue?variantId=default&arrange=matrix&rows=enabled&cols=emphasized` | Rows enabled, columns emphasized; select first cell |
| `canvas-measure` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=grid` | Select first frame; Measure; lock at frame x+35, y+35 |
| `toolbar-overflow` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=grid` | More canvas tools |
| `toolbar-viewport` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=grid` | Viewport |
| `inspector-props` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=grid` | Show inspector; wait for authored Disabled control |
| `inspector-docs` | `/story/src-components-demo-story-vue?variantId=src-components-demo-story-vue-0&arrange=grid&tab=docs` | Show inspector; wait for Message heading |
| `inspector-events` | `/story/src-components-eventbutton-story-vue?variantId=_default&arrange=grid` | Click inside rendered sandbox; show inspector; Events |
| `source-changed` | `/story/src-components-demo-story-vue?variantId=src-components-demo-story-vue-0&arrange=grid` | Source; edit message to Baseline message |
| `stories` | `/story/src-components-controls-story-vue?variantId=src-components-controls-story-vue-0&arrange=grid` | Open persisted pane `stories`; wait for mounted content |
| `search-results` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=grid` | Open persisted pane `search`; search BaseButton |
| `search-empty` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=grid` | Open persisted pane `search`; search baseline-no-such-story-7391 |
| `settings-general` | `/settings/general` | Wait for mounted content |
| `settings-appearance` | `/settings/appearance` | Wait for mounted content |
| `settings-plugin` | `/settings/reference:settings` | Wait for Issue badges checkbox |
| `markdown` | `/story/src-longfile1-story-js` | Wait for document heading |
| `embed-dialog` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=grid` | Embed; Embed this variant |
| `plugin-pane` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=single` | Open persisted pane `reference:overview`; wait for mounted content |
| `plugin-inspector` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=grid&tab=reference:audit` | Wait for mounted content |
| `plugin-overlay` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=grid` | Wait for frame audit badge |
| `plugin-view` | `/story/src-components-basebutton-story-vue?variantId=src-components-basebutton-story-vue-0&arrange=reference:compare` | Wait for all three leased button frames |
| `coexistence-v3` | `/story/tailwind?variantId=box-shadow&arrange=single` | Wait for rendered Tailwind token samples |
| `coexistence-v4` | `/story/nuxt-ui-rstore?variantId=main&arrange=grid` | Wait for Show toast and Fixture items |

The full source of each action lives in `evidence/capture-actions.mjs`; fresh preferences are seeded in `capture.mjs`. Matrix intentionally selects one cell so its inspector and selected-cell chrome are covered. Measurement uses Grid: the Single view has no measurable frame selection on initial navigation in this baseline.

## Capture calibration and differences

First full comparison had 11 differences out of 104 image pairs (0.0917%–1.3662% changed pixels). [Initial ratios](evidence/initial-comparison.json) and diff images are retained. These were capture-state differences, with no app/style change between runs:

- `canvas-list-{light,dark,compact}` and `canvas-single-{light,compact}`: one capture still showed native controls skeletons. Capture now waits for visible `WorkbenchLoadingSkeleton` instances to disappear.
- `canvas-grid-narrow`, `canvas-measure-narrow`, `plugin-inspector-narrow`, `plugin-overlay-narrow`: late fonts changed text metrics, truncation and measurement-hint geometry. Capture now waits for network quiescence, then all document/frame fonts and images, followed by layout frames.
- `plugin-pane-{light,dark}`: the reference plugin lists audit rows in frame-completion order. Its recipe now uses Single view with one real audited frame, preserving the pane while removing that uncontrolled ordering variable.

Network/control waits reduced the differences to three narrow views: Matrix, Measure and plugin overlay ([second comparison](evidence/settled-comparison.json), diffs). Their computed CSS typography agreed, while rasterized text still differed. Explicitly awaiting the shipped Manrope 400/800 and JetBrains Mono 400 font faces removed all differences in a focused three-screen probe ([probe comparison](evidence/font-probe-comparison.json)). The final recipe includes those font loads, and all narrow captures are refreshed with it.

Recipe calibration also scoped event clicks to `[data-test-id="sandbox-render"]` because hidden discovery mounts contain duplicate buttons, selected an actual Grid frame before activating Measure, forced IPv4 for CLI localhost binding, and used Nuxt's real `/_stories/` base. None of these changes modifies application source or CSS.

## Final capture result

- 26 screens × 4 modes = **104 PNGs**, all captured without browser errors. [Manifest](evidence/baseline/manifest.json), [summary](evidence/capture-summary.json).
- Baseline PNGs: **8,301,836 bytes**. Entire baseline directory: **8,372,068 bytes**, below 30 MB.
- Chromium **147.0.7727.15**, capture Node **v24.16.0**, DPR 1. PNG headers were checked against the declared 1440×900 / 375×812 viewports.
- Independent repeat: **104/104 pairs match**, **0 detected changed pixels**, no missing captures, no dimension mismatches. Pixelmatch threshold **0.1**, anti-aliased pixels included. [Per-screen comparison](evidence/comparison.json).
- Final narrow recapture with explicit font-face loading closed the three remaining differences. The earlier 11-diff and 3-diff comparisons are retained as calibration evidence; no unexplained final diff remains.
- Capture servers on 4610 and 4611 were stopped by their recorded child PIDs after each session. PID lifecycle is in the `capture-*.log` files under logs.

Closing checks pass: `pnpm run lint` reports zero errors and 39 existing warnings; `node --test plans/tailwind-only/evidence/compare.test.mjs` passes its CLI scenario; style scan still lists the expected 136 Vue files with `<style>`; `git diff --check` is clean. All build/suite/browser work ran under the global lock. Raw output and exact commands are in the command ledger.

## Inventory

All 152 inventory paths and byte counts match the committed plan: 136 styled `.vue` files and 16 `.css`/`.pcss` files. No additions, removals or moves. [Regenerated inventory](evidence/inventory.json), selector consumers, and [localized drift note](inventory.md#inventory-drift--slice-01-2026-10-25). Additional runtime/test marker hooks are listed in that drift note; no marker or style was edited.

## Coverage boundaries

- Static books remove dev-only UI: Home needs-attention/status data; side-pane Tests and running tree; visual result viewer, slider and dock; MCP activity; AI threads; comment pins, agent markdown, attachments, sessions and questions; Agents settings; screenshot capture popover. These cannot be truthfully captured through static Vue3 UI.
- `examples/vue3` **does** wire `referencePlugin` (React variant), so its rail pane, inspector tab, frame overlay, settings and custom canvas view belong to this baseline.
- Source captures exercise generated content and a real prop edit; no artificial source failure is injected.
- Vue3 embedding is disabled by its committed config: the dialog's disabled state is capturable, but a full embedded `@histoire/vue` dark host is not present in this example.
- Vue3 selects Tailwind 3 in its config. Its generated `tailwind` / `box-shadow` story supplies real token samples and generated utility classes for the coexistence screenshot. The token renderer also supplies inline value fallbacks, so this remains appearance evidence; it does not independently prove transform/ring reset isolation. No new story fixture is added in this source-free slice.
- No dev-server coexistence capture is attempted, per user's static-only instruction. Nuxt UI built-story outcome is recorded separately below.

## Exceptions and tests

No custom-CSS exceptions added. One Node CLI test covers comparison outcomes using temporary real PNG files, including identical/changed pixels, added/missing captures, dimensions, empty directories, incomplete capture manifests, and a successful manifest entry whose PNG disappeared. It does not assert app classes/styles. Test-first evidence: missing comparator initially failed; incomplete/missing-manifest cases failed with `Matching PNGs cannot hide failed capture records` and `A captured record must still have its PNG` before implementation. All pass after implementation. One scoped ESLint comment permits Node's built-in test runner for this standalone CLI test; root ESLint configuration is unchanged.

## Files and handoff

Changed: `01-baseline.md`, `baseline.md`, and only the drift section of `inventory.md`.

Created under `evidence/`: `capture.mjs`, `capture-actions.mjs`, `screens.mjs`, `serve-capture.mjs`, `compare.mjs`, `compare.test.mjs`, `dependencies.mjs`, usage `README.md`, regenerated inventory/consumer evidence, CSS sizes, validation results/failure report, capture/comparison summaries, calibration diff images, command logs, and the 104-image baseline. No existing file deleted; app source, styles, dependencies and build configuration remain unchanged.

For the orchestrator: baseline assets/tooling are ready for later slices. Full build/type gates, 13 embed failures and 6 Tailwind integration failures remain baseline findings, not fixes in this slice. Cypress requires a writable runtime configuration/cache outside this sandbox restriction. Dev-only surfaces, an embedded native host, and dedicated transform/ring coexistence probes remain outside the captured static-book matrix, as detailed above.
