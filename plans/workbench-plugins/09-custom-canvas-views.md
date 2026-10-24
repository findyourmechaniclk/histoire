# 09 — Custom canvas views

## Outcome and prerequisites

Depends on: 08. Plugins add canvas views beside Grid/List/Matrix, render managed frames through leases, and keep the inspector bound to the selected frame.

## Owned files

- `stores/canvas.ts:19`: single `CanvasArrangement` type (`BuiltinArrangement | \`${string}:${string}\``); delete inline copies in `standalone/arrangement.ts`, `CanvasViewport.vue:44,46`, `toolbar/ArrangeSwitch.vue:5-6`, `standalone/workbench.ts:247`. Standalone value; land early.
- `standalone/arrangement.ts:46`: registry-backed `isArrangement`.
- `stores/canvas-preferences.ts:4,37`: zoom fallback for non-built-in keys.
- `stores/canvas.ts:87-95,101,116,250-262`: per-arrangement policy generalized through view descriptor (`fit`, `zoomPolicy`, `layout`).
- `CanvasViewport.vue:269-276`: plugin branch rendering view with `CanvasScopedContext`.
- `toolbar/ArrangeSwitch.vue:11-14`: buttons from descriptors.

## Tests first

1. `?arrange=<plugin>:<id>` deep link resolves after `ready`; before `ready`, loading state, no fallback rewrite.
2. Switching built-in and custom views keeps story selection and leaves no orphaned frame sessions.
3. Unavailable view falls back through `resolveWorkbenchArrangement` chain.
4. Selected managed frame state reaches inspector.
5. Ledger budget holds while switching repeatedly between Matrix and a custom view.
6. Remembered per-story view snapshot (`createWorkbenchArrangement`) handles plugin values.

## Implementation steps

1. Unify type and guard first, no behavior change.
2. View descriptor optional `layout(zoom) => CanvasFrameLayout[]` lets `onMeasure` and fit treat views generically; views without layout opt out of fit.
3. On switch: unmount previous view, release its leases, then transfer selected runtime.
4. Toolbar shows only groups the active view declares supported; view switch and inspector toggle always visible.

## API changes

`canvas.view` live. `ui.defaultArrange` config keeps built-in values only in v1.

## Failure paths

View mount failure: `WorkbenchErrorState` in canvas body with action to switch to Grid.

## Validation commands

~~~bash
pnpm --filter @histoire/app build
pnpm --filter histoire test:dev
~~~

## Acceptance criteria

Example comparison view renders multiple managed frames and survives repeated mode changes without leaks.

## Non-goals

Project-config default for custom views.

## Status

2026-10-23, implementation step 1 landed (not committed). Steps 2–4 open.

- `stores/canvas-arrangement.ts`: `BUILTIN_CANVAS_ARRANGEMENTS`, `BuiltinCanvasArrangement`, `CanvasArrangement`, `CanvasDefaultArrangement`, and the single guard `isCanvasArrangement`. `stores/canvas.ts` re-exports `CanvasArrangement`; `canvas-preferences.ts` iterates the shared list.
- Inline copies removed: `standalone/arrangement.ts` (query check and private `isArrangement`), `CanvasViewport.vue` props, `toolbar/ArrangeSwitch.vue`, `toolbar/CanvasToolbar.vue` (type lines only), `frame-focus.ts`, `standalone/workbench.ts` `setArrange`.
- Deviation: `CanvasArrangement` stays built-in only. Widening to `` `${string}:${string}` `` makes `CanvasZoomByArrange` lookups unsound until step 2 adds the zoom fallback; widen the type and add the registry lookup inside `isCanvasArrangement` together. `stores/settings.ts` (`defaultArrange`) still spells `'single' | 'grid' | 'list'`; outside this brief, can adopt `CanvasDefaultArrangement`.
- Tests: `ui-arrangement.spec.ts` gains unregistered `acme:compare` fallback case.
- Commands: see slice 08 status (shared run).

## Status (steps 2–4)

2026-10-24, steps 2–4 landed (not committed).

- Type and guard: `CanvasArrangement = BuiltinCanvasArrangement | PluginCanvasArrangement` (`` `${string}:${string}` ``). `isCanvasArrangement(value, views?)` accepts built-ins, and plugin ids whose registry presence is `pending` or `available` (slice 12 `ContributionPresence` via `useContributionLookup`, no copy). Without a registry plugin ids are rejected. `isBuiltinCanvasArrangement` added.
- Deep link and memory (`standalone/arrangement.ts`): `createWorkbenchArrangement({ canvasViews })` validates both the route value and the remembered story/shared snapshot through the guard; `resolveWorkbenchArrangement` takes the registry as optional sixth argument. `standalone/workbench.ts` passes `useContributionLookup('canvas.view', extensions)`. Before `ready` a plugin deep link stays active (canvas shows `WorkbenchLoadingState`, route untouched); once missing it falls back through the existing chain.
- Zoom: `CanvasZoomByArrange` = built-in record + partial plugin record; `arrangementZoom` falls back to Fit. Saved plugin zooms with well-formed ids are read back. Store types moved to `stores/canvas-types.ts` (re-exported from `canvas.ts`, now 258 lines). `setGeometry` accepts no bounds: Fit then keeps the camera. Story view binding also saves on active-zoom changes (plugin keys).
- View descriptor (plugin-kit `CanvasViewInput`): optional `layout(zoom) => HistoireRect[]` (Fit bounds; absent opts out of fit) and `toolbar?: ToolbarGroup[]` (omitted shows all; `arrange` and `inspector` always shown).
- Rendering (`components/canvas/views/`): `canvas-views.ts` (`useCanvasViewDescriptor`, `useCanvasViewContext`, `canvasViewFitBounds`, `leasedFrameFor`), `PluginCanvasView.vue` (`ExtensionView` with the view's `CanvasScopedContext`; pending loading state; failure `WorkbenchErrorState` "<label> failed" with "Switch to Grid" through `navigation.openCanvasView('builtin:grid')`; unavailable empty state). `CanvasViewport.vue` plugin branch (299 lines), no Grid layout or visible admission in a plugin view, `onMeasure` uses the view layout.
- Leases: `createCanvasViewContext` (`extensions/canvas-service.ts`) gives each mounted view its own context whose leases use `keep: 0` (full budget; `CanvasFrameLeases.acquire(target, options, keep = 1)`) and follow a view lifetime signal. The context is disposed by a sync watcher on arrangement/descriptor change, so leases are released (queued ones withdrawn) before the next arrangement renders and admits frames, even when the plugin never releases.
- Inspector: `watchCanvasSelectedSession` gains `frameFor`; in a plugin view the first leased frame showing the selected variant publishes its session. `SelectedFrameContext.bindFrameKeys(resolve)` (bound by `canvas-extensions.ts` to the viewport registry) keys the inspector context by the owning frame (`lease:<n>`). `LEASE_FRAME_PREFIX` exported from `frame-leases.ts`.
- Toolbar: `CanvasToolbar.vue` hides groups the active view does not declare; `ArrangeSwitch.vue` lists plugin views after built-ins with `resolveContributionIcon`.
- `composables/extensions.ts`: non-throwing `useOptionalExtensionHost`; `canvas-extensions.ts` try/catch removed.

Deviations / touches outside listed ownership:

- `composables/shell-extensions.ts` (slice 12): its `useOptionalExtensionHost` copy replaced by a re-export of the new one; `useContributionLookup(kind, workbench?)` takes an explicit host because `workbench.ts` cannot inject the host it provides.
- `histoire-plugin-kit/src/types/canvas.ts`: `layout` and `toolbar` fields (plugin-kit rebuilt). public-api.md not updated (outside ownership); record under a slice 09 refinement.
- `canvas.view` `available` predicates are evaluated with the root context (slice 12 lookup), not the canvas-scoped one.

Tests:

- `histoire/src/node/__tests__/ui-canvas-views.spec.ts`: pending deep link then fallback once missing, registered view and removal fallback, remembered per-story plugin view, plugin zoom persistence and Fit fallback, layout fit vs. no-layout camera, snapshot restore of plugin zoom.
- `histoire-vue/src/__tests__/canvas-plugin-views.spec.ts`: loading state then mount with canvas context, repeated built-in/custom switches release every lease and keep selection, full-budget leasing, selected leased frame published to inspector under its lease key, budget across Matrix/custom switches, mount failure with Grid action. Verified failing with `keep: 1`, without context disposal, and without `frameFor`.
- `plugin-toolbar.spec.ts`: plugin view listed and pressed, unsupported groups hidden. Fixtures: `canvasPluginFixture` gains `gate` and returns navigation `targets`; `canvasLifetimeFixture.arrange` widened.

Commands:

- `pnpm --filter @histoire/plugin-kit build`: pass. `pnpm --filter @histoire/app build`: pass.
- `histoire-vue` `vitest run canvas matrix plugin workbench toolbar`: 78 files, 427 pass.
- `histoire` `vitest run canvas ui- matrix frame`: 78 files, 449 pass.
- Embed integration canvas subset (`preview-grid`, `matrix-numeric`, `standalone-runtime-input`, `canvas-content-sizing`, `matrix-custom`, `canvas-content-observer`): batch run 4/6 files pass; `canvas-content-sizing` (2 tests) and `matrix-custom` (1 test) failed in the batch and pass alone (3/3, 4/4), same load pattern as slice 08.
- vue-tsc `tsconfig.workbench.json`: pre-existing `CanvasViewport.vue` `responsiveDisabled` error, plus `extensions/standalone.ts` importing `provideHistoireExtensions` from `@histoire/vue/internal` (slice 13 in progress, not this slice). eslint on changed files: clean.

Open issues:

- public-api.md should record `CanvasViewInput.layout`/`toolbar`, full-budget view leases and `SelectedFrameContext.bindFrameKeys`.
- `layout` is read on measure only (switch, resize, registry changes); no explicit invalidation API for plugin-driven layout changes.
- Views without `layout` keep the previous arrangement's effective zoom on entry (Fit preference, no bounds).
- Pointer presses on plugin view content still reach canvas panning unless the view stops propagation.
- No browser proof with a real plugin view (example plugin is slice 14).
