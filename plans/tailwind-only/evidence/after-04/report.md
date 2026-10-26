# Slice 04 source hooks

Implementation details and hook table: [slice 04](../../04-source-fixes.md#status). No staging, commits, branches, dependency installs or unrelated reversions.

## Files

Created:

- `packages/histoire-vue/src/foundation/parts.ts`
- `packages/histoire-vue/src/components/source/render.ts`
- `packages/histoire/src/node/__tests__/embed/integration/extension-interactivity.spec.ts`
- `docs/reference/panel-styling.md`

Changed:

- `packages/histoire-vue/src/foundation/VirtualList.ts`
- `packages/histoire-vue/src/components/controls/HistoireControls.ts`
- `packages/histoire-vue/src/components/controls/GenericControls.ts`
- `packages/histoire-vue/src/components/controls/StatePresets.ts`
- `packages/histoire-vue/src/components/controls/PresetMenu.ts`
- `packages/histoire-vue/src/components/docs/HistoireDocs.ts`
- `packages/histoire-vue/src/components/events/HistoireEvents.ts`
- `packages/histoire-vue/src/components/tests/HistoireTests.ts`
- `packages/histoire-vue/src/components/source/HistoireSource.ts`
- `packages/histoire-vue/src/components/extensions/HistoireExtensionView.ts`
- `packages/histoire-vue/src/__tests__/source-highlighting.spec.ts`
- `packages/histoire-vue/src/index.ts`
- `packages/histoire-vue/src/internal.ts`
- `packages/histoire-controls/src/components/HstWrapper.vue`
- `packages/histoire-controls/src/components/button/HstButton.vue`
- `packages/histoire-controls/src/components/button/HstButtonGroup.vue`
- `packages/histoire-app/src/app/components/extensions/ExtensionView.vue`
- `packages/histoire-controls/src/components/textarea/HstTextarea.vue`
- `packages/histoire-controls/src/style/controls.pcss`
- `packages/histoire-vue/src/styles/extensions.css`
- `docs/guide/embedding.md`
- `docs/guide/vue3/controls.md`
- `plans/tailwind-only/04-source-fixes.md`
- `plans/tailwind-only/inventory.md`
- `plans/tailwind-only/README.md`

Deleted: none. Exceptions added: none. Evidence created under `evidence/after-04/` and `evidence/logs/04/`; original baseline and after-03 references remain unchanged.

## Behavior coverage

- Source actions: one new scenario exercises default Raw/Dynamic/Copy buttons, reactive removal/restoration, preserved real-highlighted content and usable restored actions. Only remote source transport is substituted. Red run retained as `logs/04/source-red.log`; focused final run passes three scenarios.
- Native overlays: two new real-browser scenarios use the existing embed fixture/bundler, covering Vue and DOM views above a real story iframe. Passive content cannot steal clicks or focus even with its own pointer override. Explicit interactivity restores pointer input under a pointer-transparent parent, while preserving mount identity. No component/runtime mocks.
- Pre-rebuild artifacts failed the interactive-click assertion because the underlying frame still received input; final rebuilt artifacts pass both scenarios. No class/style assertions added.

## Commands and outcomes

All builds, package suites, example builds and browser sessions ran under `flock /tmp/histoire-tailwind.lock`. Vitest/vue-tsc used `NODE_OPTIONS=--max-old-space-size=8192`. Installed Node/pnpm paths bypassed the read-only mise shim. Exact sequences: commands.txt; per-step outcomes: results.txt.

- `pnpm --filter @histoire/vue build`: passes, including final pointer changes.
- `pnpm --filter @histoire/controls build`: fails at existing vendor declarations: `Module '"@iconify/vue"' has no exported member 'Icon'`. Independent `build:css`, Vite bundle, `build:peer` (including peer types), and existing font-copy script pass.
- `pnpm --filter @histoire/app build`: fails at existing vendor declarations: `Module '"vue"' has no exported member 'createApp'`. Independent Vite bundle, `build:css` and asset-copy script pass, including final pointer changes.
- `pnpm --filter @histoire/vue test`: 155 files / 774 tests pass after final rebuild.
- `pnpm --filter @histoire/controls test`: 24 files / 90 tests pass. First run after interrupted full build lacked copied fonts; restored through existing copy script, then reran.
- `pnpm --filter histoire exec vitest run --maxWorkers=4`: 404 files / 2,083 tests pass; 1 file / 2 tests skipped.
- Focused `extension-interactivity.spec.ts` with `vitest.embed.config.ts`: 2/2 pass after final rebuild.
- `pnpm --filter histoire test:embed:integration`: 45 files / 86 tests pass; 4 files / 9 tests fail. Exact failure names match previous slice: `visual-recovery`, `visual-regression`, `visual-transport`, `vue-host-isolation`. Typical decisive lines: `ENOENT: no such file or directory, realpath`, `Visual testing requires enabled configuration and a ready development source`, `Maximum call stack size exceeded`.
- `pnpm --filter histoire test:tailwind:integration`: 8 pass / 6 fail. Same two files/six scenarios as slice 03: v4 token-content timeouts and Single-view existing-frame assertions. Decisive lines: `TimeoutError: locator.textContent: Timeout 30000ms exceeded.` and `expected 1 to be +0`. Exact baseline comparison has zero new failures in either integration suite.
- Requested root `vue-tsc` command: `Command "vue-tsc" not found`. Existing controls-package binary runs workbench project and reports same 1,309 baseline errors. No dependency installed.
- `pnpm run lint`: zero errors, 39 existing warnings. Scoped lint and `git diff --check` also pass; authored source/test files remain below 300 lines.
- `pnpm -C examples/vue3 story:build`: passes. `pnpm run test:examples` reaches Cypress but cannot run tests: `EROFS: read-only file system, open '/home/akryum/.config/Cypress/cy/production/cache'`. User configuration left untouched.

## Screenshots

48 captures cover Home, Matrix, inspector Props/Docs/Events, changed Source, search results/empty, and plugin pane/inspector/overlay/view. Each has light, dark, compact and 375px modes. Reference provenance: reference/sources.json, 43 baseline images plus the five specified after-03 font references.

Final comparison after pointer policy refinement: **48/48 exact matches**, zero changed pixels and zero browser errors. Comparison summary, capture manifest. Captures used the reusable server/capture/compare scripts on owned port 4610; both server PIDs (1753 and 2298) were stopped by the helper.

CSS sizes versus slice 03: `dist/bundled/app.css` 196,584 to 197,147 bytes (+563); `dist/style.css` 115,517 to 116,846 (+1,329). Both increases remain below 10%.

## Remaining boundaries

- Full integration runs preceded the final opt-in pointer refinement. Final native suite, focused browser scenarios and all 48 screenshots were rerun after it; broad suites were not repeated.
- No baseline image exists for static inspector Tests or an injected source error. Those are not claimed as visual proof. Native behavior suites cover the rendering/lifecycle paths.
- New opt-in tone/block/part appearances have no supplied standalone before-images; unchanged app defaults are the visual equivalence boundary.
- Full build/typecheck, existing integration failures and Cypress environment need orchestrator follow-up.
- Packed installed-consumer suites were skipped because they run dependency installation internally. CSS/JS peer artifacts and font paths were checked by existing artifact tests.

Later slices must adopt hooks in their owned app templates and remove existing deep selectors. Under E12’s unlayered output, conflicting provider defaults and Shiki inline styles require Tailwind important modifiers, documented in the new API reference.
