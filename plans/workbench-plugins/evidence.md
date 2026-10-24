# Evidence (slice 15)

## Environment and source identity

- Date: 2026-10-24. Worktree `/home/akryum/Projects/histoire/.claude/worktrees/workbench-plugins`, branch `worktree-workbench-plugins`, HEAD `2387a19bf6dcf8c0a6382decac524670f72448f5`; slices 01–15 uncommitted (≈206 entries in `git status --short`).
- Linux 7.2.11 (Fedora 44), Node v24.22.1, pnpm 10.33.0.
- Machine load from unrelated projects: load average 22–90 during runs. Timing-sensitive failures were rerun in isolation; each is listed below with its isolated result.

## Final commands

Run 2026-10-24 01:53–02:35 after the source review, from the worktree root. Load average 20–75 during runs.

Pre-checks:

- `eslint --no-warn-ignored` on all 338 changed/untracked source files from `git status --short`: pass, no errors or warnings.
- `vue-tsc --noEmit -p packages/histoire-app/tsconfig.workbench.json`: only the known pre-existing `responsiveDisabled` error in `CanvasViewport.vue` (the known `App.vue` one did not reproduce). `tsc --noEmit -p packages/histoire-app/tsconfig.embed.json`: pass.
- Files the interrupted agent touched last (view lifecycle, extension views/outlets, toolbar, shell registry, frame channels, workbench host, canvas service, plugin-kit keys/frames/ids, Node config, reference `audit-store.ts`, docs): read back, no partial edits; deleted `view-host.ts` and `not-implemented.ts` have no remaining imports.
- `pnpm run build` (all packages + `examples/plugin-reference`): pass. This covers `pnpm --filter @histoire/app build` and `pnpm --filter histoire build` (same package scripts); `docs:build` rebuilt them again, pass.

| Command | Result |
| --- | --- |
| `pnpm --filter @histoire/plugin-kit test` | pass, 12 files / 72 tests |
| `pnpm --filter @histoire/protocol test` | pass, 20 files / 94 tests |
| `pnpm --filter @histoire/sdk test` | pass, 29 files / 148 tests |
| `pnpm --filter @histoire/vue test` | pass, 148 files / 742 tests |
| `pnpm --filter histoire test` | 365 passed, 3 failed, 1 skipped files; 1954 passed, 3 failed, 2 skipped tests. All 3 failures were 10 s test timeouts at load 75 (`test-specs.spec.ts`, `test-targeting.spec.ts`, `mcp/test-cancellation.spec.ts`); isolated rerun of the 3 files: pass, 20 tests. `test:dev` below reran the full suite green |
| `pnpm --filter @histoire/app build` | pass (via `pnpm run build`) |
| `pnpm --filter histoire build` | pass (via `pnpm run build`) |
| `pnpm --filter histoire test:embed:integration` | 43 passed, 4 failed files; 87 passed, 4 failed tests. See reruns below |
| `pnpm --filter histoire test:embed:consumers` | pass, 3 files / 7 tests (includes packed `plugin-reference.spec.ts`) |
| `pnpm --filter histoire test:dev` (`CI=1`, single run) | pass, 368 files (1 skipped) / 1957 tests (2 skipped) |
| `pnpm run lint` | pass, 0 errors, 38 warnings (all in unchanged files; changed files lint clean) |
| `pnpm run docs:build` | pass; demo book (`histoire.docs.config.ts`) contains no reference plugin manifest entry |

`test:embed:integration` failures and isolated reruns:

- `independent-panels.spec.ts` (`expected ['mounting','mounting'] to deeply equal ['ready','ready']`; timed out in slice 13 too) and `workbench-vue-plugin.spec.ts` (dev): isolated rerun together, pass, 2 files / 4 tests. Load-induced.
- `canvas-content-sizing.spec.ts`: isolated rerun, pass (3 tests). Load-induced.
- `matrix-custom.spec.ts` svelte4 case (`locator.click: Timeout 30000ms exceeded` waiting for `Zoom level`): **real regression**, failed in isolation twice at load ~25; same file and case pass on the baseline main checkout. Cause: slice 14 wired `referencePlugin({ ui: 'dom' })` into the `histoire` key of `examples/svelte4/vite.config.ts`; `createMcpFrameworkProject('svelte4')` copies that example and the test only replaces `histoire.config.ts`, so the plugin's rail, inspector tab and toolbar item leaked into the fixture and pushed `Zoom level` into the toolbar overflow. Fix: wiring moved to new `examples/svelte4/histoire.config.ts` (merged with the Vite `histoire` key, like the react/vue3 examples; fixtures that write their own `histoire.config.ts` start without the plugin); `vite.config.ts` is back to its HEAD content. After the fix: `matrix-custom.spec.ts`, `preview-svelte.spec.ts`, `host-channels-frameworks.spec.ts` (all svelte4 fixture users) pass, 3 files / 9 tests; `examples/svelte4` `story:build` still ships the plugin.
- `FAIL ... fail.<hash>.histoire.spec.ts > attributed assertion` lines in the log are inner output of intentionally failing generated story tests inside passing specs, not suite failures.

## Bundle audit

Static `histoire build` of three examples, `.histoire/dist` scanned with a grep script; baseline comparison against the existing main-checkout builds of `examples/vue3` and `examples/react` (dated 2026-10-23, read only).

- `examples/react` (`story:build`, reference plugin `ui: 'vue'`): pass, 4 stories / 24 variants, 461 JS assets.
- `examples/vue3`: `story:build` fails with `[md] Cannot find story file: ../MarkdownFile.story.md` from `MarkdownLinks.story.vue` (same link on main; `markdown/` and `collect/` sources unchanged in this worktree). Audited through a temporary `examples/vue3/histoire.audit.config.ts` that spread `histoire.config.ts` and added `**/MarkdownLinks.story.vue` to `storyIgnored`; built 42 stories / 1096 variants, 555 JS assets; file deleted afterwards, no story changed.
- `examples/svelte4` (`story:build`, `ui: 'dom'`): pass, 8 stories / 33 variants, 474 JS assets (rebuilt after the config move above; manifest still lists `reference`).

Findings, all three builds:

- Node built-ins: no `from`/`import()`/`require()` of `node:*`, `fs`, `path`, `url`, `module`, `os`, `crypto`, `child_process`, `worker_threads`; no `"node:…"` specifier strings.
- Framework copies: `examples/react` has one Vue runtime (`vue.runtime.esm-bundler-*.js`, 3.5.26; the other `3.4.16` version string is DOMPurify) shared by workbench and plugin Vue views, and one React/ReactDOM in `vendor-*.js`, same as baseline. `examples/vue3` has two Vue runtimes, workbench Vue and the project's story Vue in `vendor-*.js`, exactly as baseline; React/ReactDOM appear once in `vendor-*.js` (the React UI variant). `examples/svelte4`: one Vue runtime, no React, no Svelte 5 runtime.
- Node-only plugin data: browser manifests (`virtual:$histoire-workbench-plugins`, `virtual:$histoire-frame-plugins`) hold only `id`, `apiVersion`, JSON `options` (`minTargetSize` 24, or 40 in vue3) and `load`. Zero files contain `fileURLToPath`, `HISTOIRE_REFERENCE_UI`, `REFERENCE_UI_VARIANTS`, the Node factory's `unknown ui` error, the Node plugin `name` `histoire-example-plugin-reference`, or `clientSetupFile`. No absolute path of a plugin entry; `../plugin-reference/dist/...` only appears in bundler region comments. Remaining absolute paths (`outDir`, story `moduleId`, React `_jsxFileName`, tailwind story source) are pre-existing book data: 10 files in both baseline and current react builds.
- Dev-only modules: no `/@vite/client`, `@vite/env`, `vite/dist/client` or `virtual:$histoire-dev`. The single `import.meta.hot` hit is a comment; `devOnly` hits are the built-in filter code and built-in settings/shortcut tables, not plugin descriptors. The `__vitest_browser_runner__.wrapDynamicImport` wrapper around plugin `load` matches the pre-existing wrapping of support-plugin loaders.
- `devOnly` exclusion itself is proven by `workbench-plugins-serve.spec.ts` (no example declares a dev-only plugin).

## Source review

Changes made in this slice (cleanup and API gap):

- One view lifecycle: `packages/histoire-vue/src/components/extensions/view-lifecycle.ts` (`useExtensionView`, exported from `@histoire/vue/internal`) owns the view binding, local failure capture, DOM mount, context updates and overlay root. `HistoireExtensionView.ts` and the app `components/extensions/ExtensionView.vue` use it and differ only in rendered states (inline native states vs `WorkbenchLoadingState`/`WorkbenchErrorState` with slots). App `components/extensions/view-host.ts` deleted.
- One render-key helper: `createContributionKeys()` moved from `histoire-vue/src/components/extensions/keys.ts` to `plugin-kit/src/render/keys.ts` (root export); app `ExtensionOutlet.vue`, `extensions/toolbar.ts` and `extensions/shell-registry.ts` copies replaced.
- App `extensions/frame-channels.ts`: `decorate()` proxy, local `PLUGIN_FRAMES_SERVICE` and mirrored `FrameChannelService` removed; `create-workbench-host.ts` passes `frames.service` to `createSessionContext({ frames })`, and the service is typed as plugin-kit's `PluginFrameService`.
- Plugin id grammar: `histoire` Node config and plugin-kit `isValidPluginId` both use `isHistoirePluginId` from `@histoire/protocol` (both packages already depend on it), so no new dependency and no copy. This fixed a real mismatch: protocol capped ids at 64 characters, config and definitions did not, so a longer id would have loaded and then had every channel message rejected. Docs and the shared type comment state the limit.
- `plugin-kit/src/internal/not-implemented.ts` (unused since slice 11) deleted.
- API gap: `api.frames.subscribe(listener)` (attach/detach of this plugin's frames), `PluginFrameService.subscribe` implemented by the standalone hub and by `createSessionFrameService`; reference plugin `audit-store.ts` follows it instead of the 750 ms `setInterval`.

Review results:

- Authored modules over 300 lines: only pre-existing ones, `histoire-app/.../panes/search/SearchPanel.vue` (302 at HEAD, 306 now) and `histoire-app/src/embed/adapters/runtime-frame.ts` (325 at HEAD, 308 now); `docs/.vitepress/config.js` is configuration. No new file exceeds 300 lines.
- JSDoc: heuristic scan of every changed `.ts` file for undocumented top-level declarations found only pre-existing declarations in modified files and lines inside generated-code templates.
- CSS/class assertions: none in new tests except `embed/integration/workbench-vue-plugin.spec.ts`, which checks that the plugin's button is the workbench `HstButton` and reads an inherited theme variable; that is the evidence of the shared-controls/theme gate, kept on purpose. `canvas-plugin-overlays.spec.ts` reads overlay box positions (geometry behavior, not styling).
- Duplicated fixtures: none found beyond the helpers above; test fixtures were already shared (`utils/workbench-extensions.ts`, `fixtures/canvas-plugins.ts`, `fixtures/host.ts`).
- Tests added in this slice: `host-frames.spec.ts` "notifies attach and detach of its own frames until the plugin is disposed"; `ui-frame-channels.spec.ts` attach/detach notification assertions; `ids.spec.ts` 64-character id; `histoire-vue/src/__tests__/canvas-plugin-teardown.spec.ts` (teardown stress, mutation-checked). No test removed: none found redundant enough to justify deletion.

## Final pass (after gap fixes)

Run 2026-10-24 03:20–03:55 from the worktree root, after the gap fixes and this pass's edits; ≈228 entries in `git status --short`. Load average 5–17 (much lower than slice 15).

| Command | Result |
| --- | --- |
| `pnpm run build` | pass (covers `@histoire/app` and `histoire` builds and `examples/plugin-reference`, now with `dist/client/svelte4.js`) |
| `pnpm --filter @histoire/plugin-kit test` | pass, 13 files / 79 tests (+ `tsc -p tsconfig.test.json`) |
| `pnpm --filter @histoire/protocol test` | pass, 20 files / 94 tests |
| `pnpm --filter @histoire/sdk test` | pass, 29 files / 148 tests |
| `pnpm --filter @histoire/vue test` | pass, 152 files / 761 tests |
| `pnpm --filter histoire-example-plugin-reference test` | pass, 2 files / 8 tests (Svelte 4 variant included) |
| `pnpm --filter histoire test` | pass, 369 files (1 skipped) / 1963 tests (2 skipped); config loader change (jiti `evalModule`) did not regress |
| `pnpm --filter histoire test:embed:integration` | 46 passed, 1 failed file; 91 passed, 1 failed test: `canvas-content-sizing.spec.ts` "retains measured state…" (see below) |
| `pnpm --filter histoire test:embed:consumers` | pass, 3 files / 7 tests |
| `pnpm run lint` | first run 1 error (import order in reference `variants.spec.ts`, fixed); rerun pass, 0 errors, 38 warnings (unchanged files) |
| `pnpm run docs:build` | pass |
| `tsc --noEmit -p packages/histoire-app/tsconfig.embed.json` | pass. `vue-tsc` is not installed in this worktree, so the workbench `vue-tsc` check was not rerun |
| `examples/vue3` `story:build` | pass, 43 stories / 1097 variants (the slice 15 `[md] Cannot find story file` failure is gone after the Markdown watcher fix) |
| `examples/svelte4` `story:build` | pass, 8 stories / 33 variants, with the Svelte 4 UI variant |

`canvas-content-sizing.spec.ts` "retains measured state within frame budget…": isolated reruns pass 1 of 3, then 1 of 2 runs of the whole file; with only that test (`-t`) 3 of 3 pass. It also failed in the slice 15 full run. A temporary diagnostic (reverted; the spec is back to HEAD) showed the `strict mode violation` comes from a second "Toggle size" button inside `.__histoire-test-render`, the offscreen mount of the variant test session collecting tests in the same interactive document, next to the `sandbox-render` one. `variant-test-mount.ts` and `variant-test-session/` are unchanged from `main`, and `main` collected tests in the inspector the same way (`useProvidedHistoireTestsModel`); recent `main` commit `da9d433f` already stabilized this spec for boot races. Classified as a pre-existing timing race, not fixed here; not compared by running the main checkout (kept read-only).

Config loader edge cases (ad-hoc script in the session scratchpad against the built `histoire/dist/node/config/load.js`): ESM `.js` in a `type: module` package, CommonJS `.js` (`module.exports`), TypeScript with `import.meta.url` and a local `.ts` import, top-level `await`, `node:path` plus a local `.mjs` import, `.histoire.ts`: all six load with the expected value.

### Browser verification

Dev servers started from this worktree with `preview_start` (temporary `.claude/launch.json`, removed afterwards) (`histoire dev` in `examples/vue3`, React UI, port 6116; `examples/svelte4`, Svelte 4 UI, port 6117), Claude browser pane, dark theme. Screenshots in `evidence/`:

- Inspector overflow: `react-inspector-more-tabs-menu-800px.jpg` (Audit tab with icon and badge in "More tabs"). Keyboard: Escape returns focus to the trigger; ArrowDown opens the menu with focus on "Audit 1"; Enter selects it, moves it into the row and focuses it; Home selects Props (Audit back in the menu); ArrowLeft wraps to Audit.
- Bugs found and fixed: kept active plugin tab clipped by equal tab widths (`react-inspector-overflow-tab-clipped-before-fix.jpg`); built-ins and active plugin tab overlapping at 768px (`react-768px-tabs-overlapping-before-fix.jpg`); fixed state `react-768px-compact-active-plugin-tab.jpg` and `-zoom.png` (accessible names still `Audit 1`).
- Badge refresh: `react-badge-before-report.jpg` (waiting, no badge), `react-badge-after-report-invalidate.jpg` (badge 1 once the frame report arrives).
- Narrow layouts: `react-768px-rail-pane.jpg`, `react-375px-rail-pane-drawer.jpg`, `react-375px-settings-plugin-section.jpg` vs `react-375px-settings-builtin-appearance.jpg` (first content at x = 29px in both), `react-768px-toolbar-overflow-plugin-items-hints.jpg` (Annotate `A`, Compare, Run audit, Issue badges `Alt ⇧ B`, Audit settings).
- Compare view input: Select-tool drag on a column: camera unchanged, column got 1 `pointerdown`; Pan-tool drag on the column: camera moved by the drag, column got none (`react-compare-view-pan-tool-vs-select.jpg`).
- Svelte 4: `svelte4-inspector-section.jpg`, `svelte4-rail-pane-and-tab.jpg`; "Open audit" in the Svelte 4 section navigates to the tab; no console errors.

### Final pass changes

- Toolbar `popover` items accept `command` (hint on the trigger): plugin-kit `types/toolbar.ts`, app `extensions/toolbar.ts`, `ToolbarPopover.vue`, `PluginToolbarItem.vue`; test in `plugin-toolbar.spec.ts`.
- Native `HistoireExtensionView` pending/failed states use the injected `WorkbenchLoadingState`/`WorkbenchErrorState`; test in `workbench-state-components.spec.ts`.
- Inspector tabs: content-based widths, ellipsized labels, compact active plugin tab (`isActiveTabCompact` in `tab-overflow.ts`, test in `inspector-tab-overflow.spec.ts`), word separation between label and badge kept in the accessible name.
- Reference plugin `svelte4` UI variant (`src/svelte4/`, `src/client/svelte4.ts`, Svelte 4 compiler borrowed from `@histoire/plugin-kit`'s `svelte4` dev dependency because adding one here needs a lockfile update), wired into `examples/svelte4/histoire.config.ts`.
- Docs: `docs/reference/plugin-api.md`, `docs/guide/plugins/workbench.md` (restart, hints, invalidate, cross-tab preferences, native hosts, canvas snippet parse error), plugin-kit README (shortcut bindings, Vue hosts); public-api.md superseded notes and "Refinements from final pass".

### `canvas-content-sizing` flake root cause

Pre-existing race in the spec, not a regression. The standalone Tests collector (`histoire-vue/src/tests/collector.ts`) runs `tests.collect` once per ready runtime; the interactive document then mounts an offscreen copy of the variant (`.__histoire-test-render`, ~45 ms) next to `[data-histoire-runtime-content]`. Document-wide `getByRole('button', { name: 'Toggle size' })` hits both during that window. A `main` (`2387a19b`) export in the session scratchpad passed 4 of 4, but a DOM probe there also found the offscreen copy at the click point in 2 of 3 runs. A message trace showed the same single `collect-tests` per document in both trees; it starts ~15-20 ms later after `variant-ready` in this worktree, so the window lands on the click more often. The duplicate is intended (collection needs a fresh mount whose tests may query by role, so it cannot be `aria-hidden`/`inert`). Fix: spec runtime role queries go through `runtimeContent()` (`[data-histoire-runtime-content]`). After the fix: `-t "retains measured"` 4 of 4 pass; `canvas-*`, `matrix-*`, `preview-grid` embed subset 5 files / 15 tests pass; `pnpm --filter histoire test` 369 files / 1963 tests pass.

## Startup performance

Run 2026-10-24 05:26–06:15, load average 3–21 (unrelated projects). Baseline: `git archive 2387a19b` into the session scratchpad, `pnpm install --frozen-lockfile --prefer-offline`, `pnpm run build`; deleted afterwards.

### Method

- Fixture: `createEmbedBridgeFixture` with the 3-variant `canvas-content-sizing` story, standalone workbench, no plugins, `#/story/content?variantId=first&arrange=grid`, in `dev`, `source-dev` and `static` modes. A temporary spec in each tree served the fixture until a stop file appeared (removed afterwards).
- Driver (scratchpad, Playwright Chromium headless, 1920×1080): fresh browser context per load, loads alternate between the baseline and worktree books (paired), 2 warm-ups discarded, 20–30 samples per book. Init script in every document records `message` arrivals, DOM milestones (app mounted, canvas frame, iframe, inspector, inspector content with controls), navigation and resource timings (buffer raised past 250).
- Attribution: static import graph walk of `histoire-app/dist/bundle-main.js` in both trees, per-module resource lists, CDP CPU profiles and `devtools.timeline` traces of the variant-ready → collect-tests window, DOM mutation census in that window, server latency check (300 modules, 6 lanes: worktree ≤ baseline, so the dev server is not slower per module).

### Before (medians, ms from top navigation start, paired)

| Mode | Phase | Baseline | Worktree | Δ |
| --- | --- | --- | --- | --- |
| dev (n=20) | app mounted | 493 | 573 | +80 |
| | VARIANT_READY | 845 | 932 | +87 |
| | collect-tests | 875 | 973 | +98 |
| | inspector ready | 1074 | 1155 | +81 |
| static (unpaired, 2×12) | VARIANT_READY | 308 / 349 | 319 / 285 | within ±15 noise |

Per-phase gaps (dev): top DOMContentLoaded +77…+100; app mount → iframe +5; frame startup → `sandbox-ready` +10…+25; `sandbox-ready` → VARIANT_READY ±3; VARIANT_READY → `collect-tests` +12…+15 (the flake window shift); collect → test definitions ±3. Source-dev: top DCL +58…+63, VARIANT_READY → collect +8. Static: phases within noise, +11 top chunks, +1 frame chunk.

### Attribution

1. **Top module graph (dominant, dev/source-dev only).** The workbench startup graph grew from 524 to 620 static modules (+96): plugin-kit 25, app `extensions/*` and composables ~22, plugin canvas/inspector/shell components ~31, canvas frame primitives 5, `@histoire/vue` extension provider 5, sdk/protocol/shared 4. Dev serves every module separately; the browser drains ~1.4 modules/ms, so +96 modules ≈ +70 ms before mount. Static bundles them into +12 chunks (≈ +5 ms DCL). In published installs plugin-kit, sdk, protocol and shared are expected to be prebundled by the dep optimizer (scanned from `bundle-main.js`), which the linked-workspace fixture does not do; not measured.
2. **Inspector tab overflow measurement (all modes).** `useTabOverflow` measured synchronously in `onMounted` and again in the initial `ResizeObserver` callback. The selected-frame inspector mounts right after VARIANT_READY, so the first measurement forced layout of the whole fresh inspector: trace of the window showed Layout 8.1 ms (520 dirty objects) and UpdateLayoutTree 4.6 ms vs 5.8 ms / 79 and 1.3 ms in the baseline; CPU profile attributed 5.5 ms to `measureInlineItem`. This delayed `collect-tests`.
3. **Frame plugin manifest import.** Every interactive document imported `virtual:$histoire-frame-plugins` after VARIANT_READY even with an empty manifest (one module/chunk request per frame).
4. Ruled out: workbench manifest import (6–8 ms after navigation, does not gate mount; app mounted − DCL equal within 4 ms), slice 08/09 frame admission (app mount → iframe +1…+6 ms), slice 10/11 VARIANT_READY handling (`sandbox-ready` → VARIANT_READY equal), dev server per-module latency.

### Fixes

- `tab-overflow.ts`: rows with only pinned (built-in) tabs skip measurement entirely (nothing can overflow or compact); with `ResizeObserver` the initial observation is the only mount measurement. Plugin tab overflow behavior unchanged (`inspector-tab-overflow.spec.ts`, `inspector-extensions.spec.ts` pass).
- `inspector/builtins.ts`: Docs, Events and Tests tab bodies are async components (only the active body renders; Props is the default).
- Preview runtime: `hasFramePlugins` (true when a non-excluded plugin has a `frame` entry, same `devOnly` filter as the manifest) bakes either the manifest `import()` or an empty manifest. Test: `frame-plugins-isolation.spec.ts` "skips the frame manifest import when no frame plugin is configured".
- Tried and reverted: lazy (`defineAsyncComponent`) plugin UI components (toolbar items, canvas layers/views, pane, home sections, `ExtensionView`) cut the dev graph by 29 modules but made 29 `@histoire/vue` unit tests fail on async first render. Left as a follow-up: worth ~20 ms in dev, needs those tests to await async components.

### After (medians, paired)

| Mode | Phase | Baseline | Worktree | Δ |
| --- | --- | --- | --- | --- |
| dev (n=24, load 12–16) | app mounted | 425 | 495 | +70 |
| | VARIANT_READY | 743 | 812 | +69 |
| | collect-tests | 769 | 839 | +70 |
| | inspector ready | 935 | 1013 | +78 |
| source-dev (n=24, load 3–6) | app mounted | 386 | 441 | +55 |
| | VARIANT_READY | 648 | 718 | +70 |
| | inspector ready | 867 | 946 | +79 |
| static (n=30, load 6–7) | app mounted | 91 | 97 | +6 |
| | VARIANT_READY | 265 | 274 | +9 |
| | test definitions | 337 | 347 | +10 |
| | inspector ready | 442 | 462 | +20 |

Gap changes: VARIANT_READY → `collect-tests` +3.5 ms dev, +2.4 source-dev, +2 static (was +12…+15); window UpdateLayoutTree 1.5 ms (baseline 1.3); frame documents load 29 static chunks like the baseline. Remaining dev/source-dev delta is the top module graph (item 1), unchanged by these fixes. Static is within ~10 ms of baseline at VARIANT_READY.

Validation after the fixes: `pnpm --filter @histoire/app build`, `pnpm --filter histoire build` pass; `pnpm --filter histoire test` 369 files (1 skipped) / 1964 tests pass; `@histoire/vue` 152 files / 761 tests pass; embed integration `canvas-*`, `matrix-*`, `preview-*`, `frame-plugins`, `plugin-channels`, `native-host-plugins`, `inspector-plugin-tab`, `workbench-vue-plugin`: 17 files / 33 tests pass (load ~9); eslint on touched files clean.
