# 08 — Canvas geometry, overlays, tools and frame leases

## Outcome and prerequisites

Depends on: 04, 05. Plugins annotate and interact with the canvas without querying shell DOM, and allocate managed story frames without bypassing budget or startup ordering.

## Owned files

- `histoire-app/src/app/components/canvas/frames/acquire-story-frame.ts` (new): lift `start`/`startOwned`/teardown out of `CanvasReplicaPreview.vue:108-265`; returns `{ session, ready, status, release }`.
- `components/canvas/frames/frame-ledger.ts` (new): per-viewport budget ledger provided next to `provideCanvasStartupCoordinator`; replaces separate grid/list (`CanvasViewport.vue:139-146`) and Matrix (`MatrixView.vue:69`, `budget - 1`) budgets.
- `CanvasReplicaPreview.vue`: becomes thin wrapper over `acquireStoryFrame`.
- `components/canvas/overlays/` (new): `ViewportLayer.vue`, `CanvasLayer.vue` (`translate(panOffset) scale(effectiveZoom)`), `FrameLayer.vue` (per registered frame via `frameToClient`); all `pointer-events: none` unless `interactive`.
- `CanvasViewport.vue` `#overlays` slot (`:278`): keep built-in overlays; add plugin layers.
- `stores/canvas.ts` `CanvasTool` (`:17`): registry-backed string; `canvas-preferences.ts:53` coerces unknown to `select`.
- `components/canvas/tools/plugin-tool.ts` (new): dispatch after `usePointerPan` declines (`pan/usePointerPan.ts:24-26`); use `useCanvasPointerPan` relay (`composables/canvas-settings.ts:115-122`) like `MeasureOverlay.vue:126-159`.
- `extensions/canvas-service.ts` (new): readonly geometry, transforms (`pan/usePanZoom.ts:55,60,76`), frame list, `acquireFrame`.

## Tests first

1. Overlay positions correct after pan, zoom, scroll, resize and viewport rotation.
2. Passive overlays never intercept story pointer events.
3. Space and middle-button pan suspend plugin tool handling; Escape cancels active gesture; tool removal releases pointer capture.
4. Two frames of the same variant have distinct frame keys and distinct overlay instances.
5. Releasing a lease disposes its session exactly once; release during startup cancels it.
6. Ledger: plugin lease denied or queued when budget full; selected frame always admitted first.
7. Existing grid, list, Matrix and single behavior unchanged after extraction (existing canvas tests pass).

## Implementation steps

1. Extract `acquireStoryFrame` with zero behavior change; land and verify before anything else.
2. Introduce ledger; migrate grid/list and Matrix to it; keep admission policy (`frame-layout.ts:123`).
3. Plugin leases route through startup coordinator and register in the frame registry (`registerFrame`) so `frame-interactions.ts` relays events and the context menu works.
4. Overlay layers, then tools, then canvas service.

## API changes

`canvas.overlay`, `canvas.frame-overlay`, `canvas.tool` live; `CanvasScopedContext.canvas`.

## Failure paths

Lease denied: rejected promise with budget reason. Overlay or tool failure isolated; failing tool deactivates to `select`.

## Validation commands

~~~bash
pnpm --filter @histoire/app build
pnpm --filter histoire test:dev
pnpm --filter histoire test:embed:integration
~~~

## Acceptance criteria

Plugin overlay, tool and lease work without shell DOM queries or unmanaged frames; budget holds across all views.

## Non-goals

Custom views (09); legacy `StoryVariantGridSandbox`.

## Status

2026-10-23, implementation steps 1–2 landed (not committed). Steps 3–4 open.

- Step 1: `components/canvas/frames/acquire-story-frame.ts` owns target selection, prop overrides, startup queueing (coordinator or direct, Matrix boot gate), settings/target watchers in its own effect scope, and release. Startup generation body lives in `frames/story-frame-session.ts` (300-line rule). Handle: `{ session, ready, status, start, wait, getSource, release }`; `release` is idempotent. `CanvasReplicaPreview.vue` is an 80-line wrapper; it keeps content sizing and mirrors readiness through `onStatus` because content sizing must exist before the frame watches its settings.
- Step 2: `frames/frame-ledger.ts` (`createCanvasFrameLedger`, `provideCanvasFrameLedger`, `useCanvasFrameLedger`, `holdCanvasFrameSlot`). `CanvasViewport` provides it next to the startup coordinator and holds the `matrix-primary` slot synchronously while Matrix renders; Grid/List and `MatrixView` admission read `ledger.available`. Admission policy (`liveCanvasFrames`, selected first) unchanged.
- Deviations: Matrix primary slot is held by `CanvasViewport` (it controls `CanvasMatrixPrimary.active`), not by `CanvasMatrixPrimary`; reserving inside the sibling ran after Matrix cells admitted and over-admitted one cell for a patch. `MatrixView.frameBudget` prop and the matrix slot's `frame-budget` removed; `WorkbenchApp.vue` drops its `:frame-budget` on `MatrixView` (one attribute). No lease denial/queue API yet: step 3 adds non-required reservations on top of `reserve`.
- Tests: `histoire/src/node/__tests__/canvas-frame-ledger.spec.ts` (5), `histoire-vue/src/__tests__/canvas-story-frame-lease.spec.ts` (3: release after ready, release while queued, release during connection), `histoire-vue/src/__tests__/canvas-frame-budget.spec.ts` (Matrix never exceeds budget minus hidden primary, verified to fail with a deferred reservation).
- Commands: `vitest run` in `histoire-vue` (134 files, 685 pass); `vitest run` canvas/ui/matrix subsets in `histoire` (51 files pass); `pnpm --filter @histoire/app build` pass; `test:embed:integration` full run exceeded 15 min and was stopped; canvas subset (`canvas-content-sizing`, `canvas-content-observer`, `matrix-custom`, `matrix-numeric`, `preview-grid`, `standalone-runtime-input`) 6 files, 16 tests pass; `vue-tsc -p tsconfig.workbench.json` reports one error outside this slice (`CanvasViewport.vue:120` `responsiveDisabled` missing on catalog variant type, line untouched here).
- Open: `CanvasViewport.vue` is 307 lines (303 before); split when step 4 adds overlay layers.

## Status (steps 3–4)

2026-10-23, steps 3–4 landed (not committed).

- Leases: `frames/frame-leases.ts` (`createCanvasFrameLeases`). Each lease takes one ledger slot through new `CanvasFrameLedger.tryReserve(owner, keep = 1)`, which never takes the last slot visible admission needs, so the selected frame is always admitted first. Full budget: rejected with a `FrameLeaseError` (`reason: 'budget'`), or queued FIFO with `queue: true` (granted when a slot frees; `signal` withdraws with `released`). A granted lease registers its own frame (`lease:<n>` key, distinct per lease even for one variant) in the canvas frame registry, starts through `acquireStoryFrame` and the startup coordinator, opens the frame menu from its container, and releases exactly once (session disposed once, startup cancelled, registry entry and slot freed). `ready` rejects with the startup error, or `released`.
- `frames/viewport-frames.ts` (`useViewportFrames`): ledger, Matrix primary hold, visible admission and the startup coordinator moved out of `CanvasViewport.vue`; startup order is ranked visible frames then leases in Grid/List, leases first in Single/Matrix (their ranked anchor never starts through the coordinator).
- Canvas service: `extensions/canvas-service.ts`. `createCanvasService` (live readonly `zoom`, `pan`, `viewport`, `toCanvas`, `toViewport`, `frameToViewport`, `frames()`, `acquireFrame`, `subscribe` notified post-flush on camera/registry changes and on window resize/scroll) and `createCanvasScopedContext` (root context + `canvas` capability; subscriptions owned by the viewport).
- `components/canvas/canvas-extensions.ts` (`useCanvasExtensions`): per-viewport service, context, plugin tools; registers the canvas frame registry with slice 11 plugin channels (`workbench.frames.registerFrames(registry, window)`, disposed with the viewport). Renders nothing without a workbench host (native hosts, isolated tests).
- Overlays (`components/canvas/overlays/`): `CanvasPluginLayers.vue`, `OverlayLayer.vue` (`space` prop: viewport pixels, or canvas space via `translate(pan) scale(zoom)`), `FrameLayer.vue` + `frame-overlays.ts` (one box per frame with a rendered document from `frameToViewport`; own frame-scoped context per (frame, session), retired on change), `OverlayItem.vue` (passive overlays `inert` and `pointer-events: none`; interactive ones receive input only on their own elements; pending/error states suppressed, failures recorded as diagnostics).
- Tools (`components/canvas/tools/`): `CanvasTool` is `BuiltinCanvasTool | \`${string}:${string}\``; `readCanvasTool` keeps well-formed plugin ids and coerces anything else to Select; `plugin-tools.ts` lists available tools, registers `shortcut` keys in the workbench shortcut registry (`canvas` scope, disposed with the tool), and resets to Select once plugins settled if the tool is missing or removed, or after a handler throws (`reportViewError(..., 'report')`). `plugin-tool.ts` gesture follows the MeasureOverlay relay: `useCanvasPointerPan` sees every press first (Space, middle button, Pan); declined primary presses capture the pointer; moves are suspended while panning; Escape, pan takeover, switch, removal or unmount cancel and release capture. `PluginToolLayer.vue` is the capture surface while a plugin tool is active; `ToolSwitch.vue` lists plugin tools after built-ins.
- `CanvasViewport.vue` now 290 lines (frame activation extracted to `frame-activation.ts`, budget to `viewport-frames.ts`).
- Frame keys (slice 11 request): `extensions/frame-context.ts` `SelectedFrameContext.publish(session, frameKey?)`; default `selectedCanvasFrameKey(target)` documents that Grid/List/Single key the selected frame by its target key and the canvas publishes only that entry. Canvas service, frame overlays, tool events and leases all use canvas frame ids.

API refinements (plugin-kit `types/services.ts`, `types/canvas.ts`; public-api.md not updated, outside ownership):

- `FrameLeaseOptions`: required `container`, optional `rect` (canvas position, document CSS size), `queue`, `signal`; `acquireFrame(target, options)` takes options as required.
- New `FrameLeaseFailureReason` (`budget` | `released` | `unavailable`) and `FrameLeaseError`.
- `CanvasService` adds `pan` and `frameToViewport`; `CanvasFrameGeometry.rect` documented as document box.
- Tool, overlay and frame overlay docs state coordinate spaces, pan precedence, failure fallback.

Deviations:

- One `OverlayLayer.vue` with a `space` prop instead of `ViewportLayer.vue` + `CanvasLayer.vue`.
- Plugin layers live in `CanvasViewport` (not the `#overlays` slot) and are hidden with the UI and during comment placement.
- `useExtensionHost` throws outside a workbench; `canvas-extensions.ts` wraps it in try/catch because `composables/extensions.ts` is not owned. An optional inject helper there would be cleaner.
- `acquireStoryFrame` `matrix` option is optional (leases do not feed Matrix discovery or the ordinary frame-state cache).
- In-frame click activation selects the clicked frame's own story/variant (identical for Grid/List; correct for leases of another story).

Tests (histoire-vue): `canvas-frame-leases.spec.ts` (distinct registration per lease, deny when only the selected slot is left, queue and withdraw, start after the selected anchor, dispose once, release during startup, frame menu), `canvas-plugin-tool-gesture.spec.ts` (capture and handler order, Space/middle-button pan, cancel, throwing handler), `canvas-plugin-tools.spec.ts` (shortcut, remembered/missing/unknown tool, removal mid-gesture, Escape, failing tool), `canvas-plugin-overlays.spec.ts` (frame box through pan, zoom, rotation, resize, scroll; distinct overlays for two frames of one variant; passive vs interactive; live context geometry; canvas and leased frames visible to plugin channels, verified to fail without `registerFrames`). histoire: `ui-frame-channels.spec.ts` gains "opens a channel to the selected canvas frame from an inspector-scoped frame ref". Fixtures: `canvas-lifetime.ts` optional `extras` (`setup`, `preferences`), new `fixtures/canvas-plugins.ts`.

Commands:

- `pnpm --filter @histoire/app build`: pass. `pnpm --filter @histoire/plugin-kit build` / `test`: pass (11 files, 66 tests).
- `histoire-vue` `vitest run`: 144 files, 726/728 pass; the two failures (`plugin-toolbar.spec.ts`, slice 07; `virtual-list-dynamic.spec.ts`) pass when rerun alone. Canvas subset: 29 files, 170 pass.
- `histoire` `vitest run canvas ui- matrix frame`: 77 files, 443 pass.
- vue-tsc `tsconfig.workbench.json`: only the pre-existing `CanvasViewport.vue` `responsiveDisabled` error. eslint on changed files: clean.
- Embed integration canvas subset: `preview-grid`, `matrix-numeric`, `standalone-runtime-input`, `canvas-content-sizing`, `matrix-custom`, `canvas-content-observer` pass (each in isolation; observer failed once in a batch run under concurrent load, passed alone). A first version that left the ranked visible frames out of the Single/Matrix startup order broke `canvas-content-sizing` and `matrix-custom`; the ranked part now stays in every arrangement (verified fail/pass).

Open issues:

- public-api.md should record the `FrameLease*`/`CanvasService` refinements above.
- Optional (non-throwing) `useExtensionHost` variant in `composables/extensions.ts`.
- Leases in a plugin canvas view (09) probably want `keep: 0` (no visible admission to protect); `tryReserve` takes it, the service does not expose it yet.
- Matrix-cell frames and leased frames publish no inspector session; `SelectedFrameContext.publish` accepts an explicit `frameKey` for when they do.
- No browser proof of plugin overlays/tools in the real app yet (no example plugin; slice 14).
