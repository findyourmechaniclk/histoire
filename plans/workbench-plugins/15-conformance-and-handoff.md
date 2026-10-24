# 15 — Conformance, regression checks and handoff

## Outcome and prerequisites

Depends on: 14. All [validation.md](validation.md) gates pass against the combined implementation, with evidence recorded.

## Owned files

- `plans/workbench-plugins/evidence.md` (new): executed commands, results, environment, source identity.
- `plans/workbench-plugins/conformance.md` (new): gate matrix status, unresolved limitations.
- Browser specs added under existing `histoire` integration suites; no new harness.

## Checks

1. Dev and static; standalone and embedded; selection changes; HMR; disposal; failure isolation.
2. Workbench Vue, DOM, React, Svelte 4/5 plugin views across Vue, React and Svelte story projects.
3. Keyboard navigation, focus recovery, overflow, narrow layouts, light and dark themes for every plugin surface.
4. Bundle audit: no Node deps, no unintended framework imports, no dev-only modules, no private options in browser assets.
5. Teardown stress: toggle plugins, views and selection repeatedly; assert no duplicate registrations, listeners, frame sessions, overlays or stale publications.
6. Source review: duplicated utilities, unnecessary tests, modules over 300 lines, missing JSDoc.

## Validation commands

Final commands in [validation.md](validation.md).

## Acceptance criteria

Every gate passes or is listed as an unresolved limitation with reason. No commit, push, publication or deployment implied.

## Non-goals

Remote CI runs.

## Status

Completed 2026-10-24; uncommitted, nothing pushed or published.

- Landed: [conformance.md](conformance.md) (gate matrix, limitations) and [evidence.md](evidence.md) (environment, final commands, bundle audit, source review). Source-review cleanup: shared `useExtensionView` lifecycle, `createContributionKeys()` in plugin-kit, frame-channel proxy removed, one plugin id grammar from `@histoire/protocol` (fixed a 64-character id mismatch), `api.frames.subscribe` (reference `audit-store.ts` no longer polls), unused `not-implemented.ts` deleted.
- Regression fixed during final commands: `embed/integration/matrix-custom.spec.ts` svelte4 failed deterministically (passes on main) because slice 14 put `referencePlugin` in the `histoire` key of `examples/svelte4/vite.config.ts`, which the copied MCP fixture keeps; the plugin's toolbar item pushed `Zoom level` into overflow. Wiring moved to new `examples/svelte4/histoire.config.ts`; `vite.config.ts` restored to HEAD. Example still ships the plugin.
- Deviations: `examples/vue3` audited with a temporary config excluding `MarkdownLinks.story.vue` (pre-existing markdown-link build failure); Svelte 4 adapter, narrow layouts and toolbar overflow of plugin items not browser-verified (listed in conformance limitations).
- Tests added: `host-frames.spec.ts` attach/detach notification, `ui-frame-channels.spec.ts` attach/detach assertions, `ids.spec.ts` 64-character id, `histoire-vue/src/__tests__/canvas-plugin-teardown.spec.ts` (teardown stress, mutation-checked).
- Commands: `pnpm run build` pass; plugin-kit, protocol, sdk, vue tests pass; `histoire test` 3 load timeouts, pass in isolation, `test:dev` full rerun pass; `test:embed:integration` 4 failures: 3 load-induced (`independent-panels`, `workbench-vue-plugin`, `canvas-content-sizing`, all pass in isolation), 1 regression fixed; `test:embed:consumers` pass; `lint` pass (warnings only in unchanged files); `docs:build` pass; app `vue-tsc` only the known `responsiveDisabled` error.
- Open: remote CI; limitations in [conformance.md](conformance.md#unresolved-limitations).

## Status (final pass after gap fixes)

- Landed: popover toolbar hints (`command`), shared state components in native `HistoireExtensionView`, `comment` scope kept a diagnostic (documented), docs sync (plugin-api reference, workbench guide incl. snippet parse error, plugin-kit README, public-api superseded notes), reference `svelte4` UI variant wired into `examples/svelte4`.
- Bugs found in the browser and fixed: clipped active plugin tab (equal tab widths), overlapping tabs at ≤ 768px (now ellipsis plus compact active plugin tab); accessible-name word join (`Acme3`) caught by tests during the fix.
- Deviation: the Svelte 4 compiler is resolved through `@histoire/plugin-kit`'s `svelte4` dev dependency instead of a new devDependency (would need `pnpm install`/lockfile change, not allowed).
- Commands and results: [evidence.md](evidence.md#final-pass-after-gap-fixes). Open: flaky `canvas-content-sizing.spec.ts` (pre-existing race), remote CI, limitations in [conformance.md](conformance.md#unresolved-limitations).
