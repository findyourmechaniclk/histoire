# 10 — Runtime purpose and frame-plugin lifecycle

## Outcome and prerequisites

Depends on: 01, 02. Frame plugins attach once per rendered actor in interactive frames only, after real readiness, and clean up before the actor goes away.

## Owned files

- Runtime purpose (standalone value; land first):
  - `histoire-app/src/embed/adapters/runtime-frame.ts:52`: emit `purpose=test-worker` alongside legacy `testWorker=true`.
  - `histoire/src/node/runtime/browser/preview-host.ts:62-65`: `purpose=automation` for MCP/screenshot documents.
  - Controls replica (`controls=true`) maps to `purpose=controls`.
  - `preview-runtime/preamble.ts:140-150`: parse `purpose` into `initialSelection.purpose`, default `interactive`; Matrix cells stay `interactive` with `matrix` flag.
- `histoire/src/node/virtual/preview-runtime/frame-plugins.ts` (new section): loads `virtual:$histoire-frame-plugins` only when purpose is `interactive`; attach/detach registry keyed by `actorId`.
- `preview-runtime/components.ts:10-48`: mint `actorId` per rendered wrapper; detach in wrapper `onBeforeUnmount`.
- `preview-runtime/app.ts`: attach after `markVariantReady` (`:109-126`); detach on `syncSelection`/`stopVariantStateWatchers` (`:46,132`).
- `preview-runtime/variant-bridge.ts:31-38`: detach on `STORY_CHANGED_EVENT`.
- `pagehide` listener next to `runtime-service.ts:81-88`.

## Tests first

1. Exactly one attach per rendered actor; same variant remounted in same document gets a new `actorId`.
2. HMR story change, selection change and navigation detach before teardown; late async work after detach is ignored.
3. Hook throw leaves story usable and readiness unchanged; diagnostic posted to host.
4. Module-evaluation probe: frame module never evaluated for `test-worker`, `automation`, `controls`, collection (`browser-collector.ts`), in-document test mounts (`variant-test-mount.ts`) or vitest runtime.
5. Matrix cells attach with distinct actor ids per cell.
6. Tests explicitly run inside an existing interactive frame keep that frame's attached plugins.

## Implementation steps

1. Add `purpose` plumbing and tests; no frame plugins yet.
2. Frame-plugin section: lazy import manifest, `defineFramePlugin` validation, per-plugin per-actor attach with `AbortController` and cleanup list.
3. Context state view reads the same state source as `VARIANT_READY` capture; readonly.
4. Detach ordering: abort signal, run cleanups in reverse, then allow framework unmount.
5. Never attach in legacy `StoryVariantGridSandbox` path.

## API changes

`defineFramePlugin` live; frame URL gains `purpose` (internal, additive).

## Failure paths

Frame manifest import failure: diagnostic once per document; story unaffected.

## Validation commands

~~~bash
pnpm --filter histoire test
pnpm --filter histoire build
pnpm --filter histoire test:embed:integration
pnpm --filter histoire test:dev
~~~

## Acceptance criteria

Lifecycle works independent of story framework (Vue, React, Svelte examples) and does not change automation defaults.

## Non-goals

Messaging (11).

## Status

Step 1 (runtime purpose plumbing) landed, 2026-10-23. Steps 2–5 (frame plugins, manifest, `actorId`) not started.

What landed:

- `packages/histoire-shared/src/frame-purpose.ts` (exported from `@histoire/shared`): `HistoireFramePurpose`, `FRAME_PURPOSE_PARAM`, `setFramePurpose(url, purpose)` (also writes legacy `testWorker=true` / `controls=true`), `getFramePurpose(query)` (explicit known `purpose` wins, else legacy `controls=true` / `testWorker=true` / `mcpNonce`, else `interactive`), `isInteractiveFramePurpose`. Placed in shared, not protocol: the generated runtime already imports helpers from the `@histoire/shared` runtime entry, `histoire-app` and Node `preview-host.ts` import shared too, and purpose is an internal contract that should not widen the portable `@histoire/protocol` API.
- `packages/histoire-app/src/embed/adapters/sandbox-urls.ts` (new): `createRuntimeFrameUrl` (primary/canvas replica/Matrix, purpose implicit `interactive`), `createTestWorkerUrl` (`purpose=test-worker`), `createControlsReplicaUrl` (`purpose=controls`). `runtime-frame.ts` (325 → 308 lines) and `controls-replica.ts` use them; query order unchanged.
- `preview-host.ts`: `purpose=automation` on MCP/screenshot documents.
- `preamble.ts`: `initialSelection` emitted by new `previewInitialSelection()`; adds `purpose: getFramePurpose(...)`. `controls`, `matrix`, `grid` flags parsed exactly as before.

Deviations: `test-workers.ts` unchanged (URL comes from the injected `createUrl`). Interactive documents do not emit `purpose=interactive`; absence means interactive, keeping existing URLs stable.

Tests: `packages/histoire/src/node/__tests__/frame-purpose.spec.ts` — host-built URL for each document kind (primary, Matrix cell, test worker, controls replica, MCP automation) evaluated through generated `initialSelection` with the real parser; legacy and unknown-value inference.

Commands: `pnpm --filter @histoire/shared build` pass; `npx tsc -p tsconfig.embed.json --noEmit` (histoire-app) pass; `pnpm --filter histoire build` pass; `pnpm --filter histoire test` pass (351 files); `pnpm --filter @histoire/app build` pass; embed integration `tests-execution`, `controls-static`, `controls-overlays` pass. Full `pnpm --filter histoire test:embed:integration`: 38/42 files passed on first run; the 4 failing files (`controls-overlays`, `host-channels`, `matrix-custom`, `docs-source`) failed because a concurrent agent rebuilt histoire `dist` mid-run (`Cannot find module .../dist/node/collect/run.js`), and on rerun all 4 passed.

Open issues:

- `packages/histoire/src/node/build/collect.ts:55-59` builds `previewStory` plugin (screenshot plugin) URLs without `purpose`; those resolve to `interactive`. Not owned here; should emit `automation` before frame plugins land.
- Test-worker documents still render and fire `VARIANT_READY`; `test-workers.ts` waits for it before `RUN_TEST_CASE`. Frame-plugin eligibility must use `purpose`, not readiness.

### Steps 2–5 (frame plugins, `actorId`, lifecycle), 2026-10-23

What landed (`packages/histoire/src/node/virtual/preview-runtime/` unless noted):

- `frame-plugins.ts` (new section, after `variant-bridge`): `framePluginsEnabled = isInteractiveFramePurpose(initialSelection.purpose)`; manifest loaded once per document on first attach through `importFramePluginManifest()` (preamble, dynamic `import('virtual:$histoire-frame-plugins')`); per-entry load and validation (object, id equals descriptor id, `apiVersion: 1`, `attach` function); per-plugin per-actor attachment with its own `AbortController` and cleanup list; frozen `FramePluginContext`; readonly state view; channel stub.
- `frame-actors.ts` (new, emitted by `previewFramePlugins`): one slot per mounted renderer; actor generations (`pending`, `attaching`, `attached`, `detached`); `attachFrameActors`, `detachFrameActors` (detach, then fresh pending actor), `handleFrameStoryChanged`.
- `components.ts`: new `PreviewFrameActor` wrapper takes the keyed (`variant.id`) renderer position inside `PreviewTestCapture`; creates the slot in setup, disposes it in `onBeforeUnmount`. `element` is the `.__histoire-preview-canvas` root (template ref).
- `app-selection.ts` (new): `waitForVariantSnapshot`, `markVariantReady`, `syncSelection` moved out of `app.ts` (was 299 lines) unchanged, plus hooks: attach after `VARIANT_READY` is posted (skipped when `selection.grid`); detach at the start of `syncSelection` for slots whose target differs from the next selection (same-target re-sync keeps its actor).
- `variant-bridge.ts`: `STORY_CHANGED_EVENT` calls `handleFrameStoryChanged` before invalidation. `runtime-service.ts`: `pagehide` detaches every actor. `index.ts`: section ordering. `preamble.ts`: imports `onBeforeUnmount`, `isInteractiveFramePurpose`; declares `importFramePluginManifest`.
- `build/collect.ts`: `previewStory` callback URLs carry `purpose=automation` via `setFramePurpose`. Closes the step 1 open issue.

Deviations:

- Failure diagnostics are `console.error` with `[histoire plugin "<id>"] frame <phase> failed:` attribution, not a host message: no runtime-only message constant exists in `histoire-app/src/app/util/const.ts` (all re-exported from shared/protocol, outside this slice's ownership). TODO left in `reportFramePluginError`. Manifest import failure is reported once per document (cached promise).
- `channel` is a frozen stub until slice 11: `post` rejects (`Plugin channel unavailable`, `code: 'CAPABILITY_UNAVAILABLE'`), `on` returns a no-op disposer, `getDroppedCount` returns 0. No plugin-kit type change.
- HMR: actors of the changed story detach, then re-attach as new actors after two ticks and a frame if the renderer stays mounted. Vue HMR keeps the renderer and emits no new readiness; without this plugins would vanish after every edit in standalone dev.
- State view: `value` is the frozen serialized projection `getRuntimeState(variant).get()`, same source as the `VARIANT_READY` capture; `subscribe` is a deep watcher on variant state, stopped by the attachment signal.
- Definition validation repeats the `defineFramePlugin` checks inline: `histoire` does not depend on `@histoire/plugin-kit`, and an entry may default-export a plain object.

Tests added (`packages/histoire/src/node/__tests__/`):

- `frame-plugins-lifecycle.spec.ts` (generated runtime, jsdom): one attach per actor, new `actorId` per remount, restored readiness is a no-op; selection detach before renderer unmount, abort then reverse cleanups; HMR (other story ignored) and pagehide detach; late async disposer and late `onCleanup` run immediately; HMR re-attach with new id; sync, async, invalid and unloadable plugins leave readiness and other plugins intact with attributed errors; readonly state and subscribe; channel rejects; no manifest import for `test-worker`, `automation`, `controls`; no attach on legacy grid; Matrix cells get distinct actors.
- `frame-plugins-isolation.spec.ts`: manifest reachable only from the preview runtime (dynamic import), never from collector, Vitest harness, Vitest browser runtime or in-document test mount.
- `embed/integration/frame-plugins.spec.ts` (static and dev): real frame entry reporting through `page.exposeBinding`; single attach in the primary document with target, options, element; preview test run spawns `purpose=test-worker` documents that never evaluate the module, and the primary actor stays attached; selection change detaches and attaches a new actor. Mutation check (gate forced on in `dist`) fails the test.
- `frame-purpose.spec.ts`: build `previewStory` callback document parses as `automation`.
- Fixtures extended, not duplicated: `utils/preview-runtime-app.ts` (purpose, matrix, manifest stub, pagehide, HMR handler), `utils/embed/bridge-fixture.ts` (`plugins` option).

Commands:

- `pnpm --filter histoire build`: pass.
- `pnpm --filter histoire test`: 359 files pass; `workbench-vue.spec.ts` (2 tests) fails, also in isolation. It is slice 04's untracked in-progress spec (`vite/workbench-vue.ts`), unrelated.
- Embed integration: `frame-plugins` (static, dev), `tests-execution`, `preview-grid`, `matrix-custom`, `matrix-numeric`, `controls-static`, `controls-overlays`, `preview-frameworks`, `preview-async-readiness`, `standalone-adoption`, `host-channels`, `preview-svelte`, `preview-vanilla`, `preview-failure`, `standalone-runtime-input`, `preview-hmr`, `visual-recovery`: all pass. Full integration suite not run.
- eslint on changed files: pass.

Open issues:

- Host-visible diagnostic message type for frame plugin failures (needs a shared/protocol constant; slice 11 or owner of `const.ts`).
- A story switch inside one document with an identical variant id keeps the renderer (key stays `variant.id`): its actor detaches in `syncSelection` and re-attaches only if the support plugin re-emits readiness. Same limit as existing `VARIANT_READY`; variant ids are normally story-unique.
- React/Svelte stories covered indirectly (framework-neutral wrapper; `preview-frameworks`, `preview-svelte` pass); no per-framework frame plugin assertion.
