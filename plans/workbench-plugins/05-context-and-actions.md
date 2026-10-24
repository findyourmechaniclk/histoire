# 05 — Scoped context, navigation and action services

## Outcome and prerequisites

Depends on: 03. Every surface consumes the same scoped contexts and one action runner. Standalone workbench creates and owns the extension host.

## Owned files

- `histoire-app/src/app/extensions/`: `create-workbench-host.ts` (called from `standalone/workbench.ts` next to `createShortcutRegistry`, `:118`), `context.ts` (root and frame-scoped context from SDK session and selected session), `navigation.ts` (adapter over `standalone/navigation.ts`), `dev-events.ts` (wraps `util/dev-event-api.ts`), `storage.ts` (project-namespaced localStorage).
- `histoire-plugin-kit/src/host/actions.ts`: action runner (captured scope, abort, pending, error).
- `histoire-app/src/app/composables/extensions.ts`: `useExtensionHost()` inject helper.

## Tests first

1. Inspector-scoped action modifies the selected frame's session, not the root session or a previously selected one.
2. Frame-menu action keeps the right-clicked frame target after selection moves elsewhere.
3. Selection or source change aborts pending action; late result discarded.
4. Static book host reports `devEvents` unavailable in `capabilities`; access returns `undefined`, never throws.
5. Existing `__HST_PLUGIN_API__.sendEvent` and plugin commands still execute through established path.
6. Plugin preferences persist per project namespace and do not collide between plugins.

## Implementation steps

1. Build root context from `HistoireSession` (catalog, docs, source, settings, tests) using SDK public methods only; no app store exposure.
2. Frame-scoped context reads selected session from `watchCanvasSelectedSession` (`components/canvas/frame-selection.ts:50`) or explicit frame from registry.
3. Navigation adapter delegates to existing navigation (`standalone/navigation.ts:90` for tabs) and validates targets against registry once `ready` settled.
4. Dev events: inject service only when `import.meta.hot` and dev source; keep global API.
5. Install configured plugins from `virtual:$histoire-workbench-plugins` in `standalone/mount.ts` before app mount; do not block first paint on plugin setup (outlets show loading state until `ready`).

## API changes

`WorkbenchContext`, `FrameScopedContext`, action contract per public-api.md.

## Failure paths

Unavailable service: absent plus capability flag. Navigation to unknown contribution after `ready`: ignored with diagnostic.

## Validation commands

~~~bash
pnpm --filter @histoire/plugin-kit test
pnpm --filter @histoire/app build
pnpm --filter histoire test:dev
~~~

## Acceptance criteria

Later surface slices only consume these contexts and the runner; none create their own.

## Non-goals

Canvas service (08), plugin channels (11), embedding hosts (13).

## Status

Landed 2026-10-23 (uncommitted).

- `histoire-app/src/app/extensions/`:
  - `context.ts`: `createRootContext` from public `HistoireSession` methods only (`getSnapshot`, `subscribe`, bound `catalog.*`); no app store exposure. Capabilities `catalog`, `navigation`, `preferences`, plus `devEvents` when present; `canvas`/`frames` absent until 08/11. Rotates two generation scopes: source (`url`, `sourceId`, `epoch`; revisions keep it) and selection (child of source). `selectionSignal()`/`sourceSignal()` resynchronize before returning, so callers never capture a stale scope regardless of subscriber order. `subscribe` fires only on selection/source change.
  - `frame-context.ts`: `createFrameContext` (explicit frame; scope = source generation + optional caller signal; `runtime` and `subscribe` subscriptions released on retirement) and `createSelectedFrameContext` (`publish(session)`; scope parented on the selection scope; a frame session whose selection differs from the canonical one is not admitted).
  - `navigation.ts`: `NavigationService` adapter. `builtin:` ids map to existing route values (`builtin:props` -> `?tab=`), validated with existing exports (`getInspectorTabs`, `isShellPane`, `SETTINGS_SECTIONS`, `BUILTIN_CANVAS_ARRANGEMENTS`). Plugin ids open when registered; before `ready` they wait, after `ready` unknown ids are ignored with a warning. A later navigation of the same kind supersedes a waiting one.
  - `dev-events.ts`: `resolveDevEventService` returns `undefined` unless dev source and `import.meta.hot`; `send` goes through `window.__HST_PLUGIN_API__.sendEvent` read at call time (`CAPABILITY_UNAVAILABLE` when not installed). Global API untouched.
  - `storage.ts`: guarded `localStorage`; namespace `_histoire-ui:<origin><pathname>` of the book base.
  - `plugins.ts`: manifest entry -> host plugin. Import runs inside `setup`, so host creation is synchronous and never waits for plugin code; mismatched exported id rejected.
  - `create-workbench-host.ts`: `createWorkbenchHost` returns `{ host, context, selectedFrame, rootScope(), frameScope(), run(id, scope?), dispose() }`. `run` is the single action runner surfaces use (captured context + signal into `host.run`).
  - `standalone.ts`: `useStandaloneExtensionHost(props, targets)`: creates, provides, feeds `props.runtime.current` into `selectedFrame` (canonical session = no frame), disposes with the provider.
- `composables/extensions.ts`: `provideExtensionHost`/`useExtensionHost`, `provideWorkbenchPlugins(app, entries)`/`injectWorkbenchPlugins()`.
- `standalone/workbench.ts`: one call next to `createShortcutRegistry` with inspector tab, pane, settings and arrange targets.
- `standalone/mount.ts`: imports `workbenchPlugins` from `virtual:$histoire-workbench-plugins` (slice 02 landed) and `app.provide`s it before mount.
- `histoire-app/package.json`: `@histoire/plugin-kit: workspace:*`.

Deviations:

- `actions.ts` already landed in plugin-kit (03); slice 05 adds only the app runner (`WorkbenchHost.run`). Pending state is the promise.
- Test 1: `FrameRuntimeView` is readonly by contract, so the test proves reads and subscriptions bind to the selected frame session, not root or previous frame. No plugin-kit type change.
- Frame-menu (explicit frame) scopes survive selection changes and retire on source change; selected-frame and root scopes retire on selection or source change.
- Plugin module load failures are recorded as `setup` diagnostics (load runs inside setup); invalid manifest id/apiVersion stay `load`.
- Navigation diagnostics go to `console.warn` (no public host API to record host-level diagnostics).
- Plugin panes, settings sections and canvas views pass through to existing guards (`isShellPane`, settings normalize, `isCanvasArrangement`), which drop them until slices 09/12 widen the guards; plugin inspector tab ids go to `?tab=` and fall back to Props until 06.
- `virtual.d.ts` left as is (`load` returns `{ default: unknown }`, matches `WorkbenchPluginEntry`).

Tests (`histoire/src/node/__tests__/`, shared helper `utils/workbench-extensions.ts` reusing `createEmbedSnapshot`, `memoryStorage`, `deferred`, `flushMicrotasks`):

- `ui-extensions-scopes.spec.ts`: selected-frame binding (not root/previous; previous scope aborted; subscriptions released on dispose), right-clicked frame kept after selection moves, selection change aborts and discards late failure, source change aborts root action while unrelated publications do not.
- `ui-extensions-services.spec.ts`: static/no-HMR dev events absent and unavailable, dev events through the global installed after the service, preferences per project namespace without plugin/project collisions, built-in navigation mapping, deferred plugin targets and unknown-id diagnostics, superseded deferred navigation, non-blocking install with failing and mismatched entries isolated.

Commands:

- `pnpm install --prefer-offline`: pass.
- `pnpm --filter @histoire/plugin-kit test`: pass (7 files, 50 tests).
- `pnpm --filter @histoire/app build`: pass.
- `pnpm --filter histoire test`: pass (356 files, 1897 tests).
- `tsc --noEmit -p packages/histoire-app/tsconfig.workbench.json`: only pre-existing `../App.vue` module error.
- eslint on changed files: clean.

Open issues:

- Plugin preferences ignore cross-tab `storage` events (plugin-kit store has no external-change hook).
- No browser run: no visible UI in this slice; installed-consumer resolution of `@histoire/plugin-kit` from `@histoire/app` dist follows the `@histoire/sdk` precedent, to be proven in 15.
- `useExtensionHost` throws outside a workbench; native `@histoire/vue` hosts (13) must provide one.
