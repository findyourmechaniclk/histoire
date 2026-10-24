# 01 — Contracts, package skeleton and baseline

## Outcome and prerequisites

Depends on: none. Establishes `@histoire/plugin-kit` and the type contracts in [public-api.md](public-api.md). Later slices implement behavior against these types.

## Owned files

- New `packages/histoire-plugin-kit/`: `package.json` (exports `.`, `./frame`, `./vue`, `./vue/mount`, `./react`, `./svelte4`, `./svelte5`; optional peers `vue`, `react`, `react-dom`, `svelte`), build config matching `@histoire/sdk`, `tsconfig`, vitest config.
- `src/types/`: contribution union split per surface (`inspector.ts`, `toolbar.ts`, `canvas.ts`, `shell.ts`, `menus.ts`), `view.ts`, `context.ts`, `actions.ts`, `preferences.ts`, `frame.ts`, `channel.ts`, `host.ts`.
- `src/define.ts`: `defineWorkbenchPlugin`, `defineFramePlugin` (identity functions with runtime validation of `id`/`apiVersion`).
- `src/ids.ts`: id validation and `${pluginId}:${id}` qualification; reserved `builtin`.
- `packages/histoire-shared/src/types/plugin.ts`: add `WorkbenchPluginDescriptor` and optional `Plugin.workbench`.
- Workspace wiring: root `tsconfig` references, `pnpm-workspace` already globs `packages/*`.
- `plans/workbench-plugins/baseline.md`: recorded baseline from [validation.md](validation.md).

## Tests first

1. Importing root `@histoire/plugin-kit` in plain Node (no DOM globals) succeeds and pulls no `vue`, `react`, `svelte`, `vite` module.
2. Type fixtures (`expectTypeOf` / `@ts-expect-error`) reject unknown contribution kinds, view contributions without `component` or `mount`, actions without `run`, frame definitions without `attach`.
3. Existing Node-only `Plugin` objects (vue, svelte, react, nuxt, percy, screenshot plugins) type-check unchanged.
4. `defineWorkbenchPlugin` rejects invalid ids, `builtin`, and `apiVersion !== 1` with attributed errors.

## Implementation steps

1. Record baseline.
2. Scaffold package, copying build/test setup from `@histoire/sdk` rather than inventing new config.
3. Write types exactly as public-api.md; JSDoc every field.
4. Import `HistoireJsonValue` and `HistoireTarget` from `@histoire/protocol`; never redefine.
5. Add `Plugin.workbench` in shared types; no Node behavior yet.
6. Inventory current registries and closed unions into [architecture.md](architecture.md) surface table if anything drifted.

## API changes

New package, new optional `Plugin.workbench`. No runtime behavior change.

## Failure paths

Invalid definitions throw at definition time with plugin id in message. Malformed descriptors are validated in slice 02, not here.

## Validation commands

~~~bash
pnpm --filter @histoire/plugin-kit test
pnpm --filter @histoire/plugin-kit build
pnpm --filter @histoire/shared build
pnpm --filter histoire build
pnpm run lint
~~~

## Acceptance criteria

- Contracts compile and are documented.
- No dependency cycle among protocol, plugin-kit, SDK, app and vue packages.
- Baseline recorded.

## Non-goals

Loading, host behavior, rendering.

## Status

Landed 2026-10-23 (uncommitted).

- `packages/histoire-plugin-kit/`: package modeled on `@histoire/sdk` (`rimraf dist && tsc`, vitest, protocol tsconfig base). Exports `.`, `./frame`, `./vue`, `./vue/mount`, `./react`, `./svelte4`, `./svelte5`; optional peers `vue`, `react`, `react-dom`, `svelte`; only dependency `@histoire/protocol`.
- Types in `src/types/` per surface. Root and `/frame` import nothing but `@histoire/protocol`.
- `src/define.ts`: `defineWorkbenchPlugin`, `defineFramePlugin`, `PLUGIN_API_VERSION`; validation throws `PluginDefinitionError` (`src/errors.ts`) carrying `pluginId`.
- `src/ids.ts`: `isValidPluginId`, `assertPluginId`, `qualifyId`, `parseQualifiedId`, `BUILTIN_NAMESPACE`.
- Adapter entries (`/vue` `useWorkbenchContext`, `/vue/mount` `vueView`, `reactView`, `svelte4View`, `svelte5View`) are typed stubs throwing "not implemented" at call time (`src/internal/not-implemented.ts`); `defineWorkbenchComponent` is a working identity helper. They import no framework yet.
- `histoire-shared/src/types/plugin.ts`: `WorkbenchPluginDescriptor`, optional `Plugin.workbench`.
- Baseline: [baseline.md](baseline.md).

Deviations (refinements, public-api.md not yet updated):

- Extra type files beyond the plan list: `base.ts` (`ContributionBase`), `commands.ts` (command/shortcut), `services.ts` (catalog/navigation/dev events/canvas service and frame lease), `contribution.ts` (`ContributionKindMap` single source of kinds, `WorkbenchContribution`, `QualifiedContribution` adds `pluginId`/`localId`), `plugin.ts` (`WorkbenchPluginApi`, `WorkbenchPluginDefinition`).
- Helper inputs are `XxxInput` types; registered shapes are `XxxInput & { kind }`. View exclusivity enforced (`component` xor `mount`).
- Inspector tabs/sections receive `FrameScopedContext` (inspector is bound to the selected frame). `canvas.frame-overlay` receives `FrameScopedContext`. Context menu entries receive `ContextMenuContext` (`WorkbenchContext` + captured `target`).
- `inspector.section.tab` typed `BuiltinInspectorTab | 'footer' | `${string}:${string}``; unqualified names rejected at compile time, unknown qualified ids left to slice 06 runtime.
- `ExtensionHostServices` is `{ context, storage?, storageNamespace? }` instead of "session, navigation, storage, capabilities": the root `WorkbenchContext` already carries navigation and capabilities, and plugin-kit cannot depend on SDK session types. Slice 03/05 may extend.
- `CanvasService`, `NavigationService`, `FrameLease` shapes are first proposals; slices 05/08 own refinement.
- `PluginDefinitionError` and `PLUGIN_API_VERSION` are additional public exports.
- No root `tsconfig.json` exists; eslint config already covers `packages/*`. No workspace wiring changes needed beyond `pnpm install` (lockfile updated).

Tests (`pnpm --filter @histoire/plugin-kit test` runs vitest then `tsc -p tsconfig.test.json`):

- `define.spec.ts`: invalid ids, `builtin`, `apiVersion !== 1`, missing hooks, attributed errors.
- `ids.spec.ts`: qualification round-trip, reserved namespace, malformed ids.
- `imports.spec.ts`: root and `/frame` import in plain Node without DOM via package self-reference; root/frame emitted graphs import only `@histoire/protocol`; every export subpath resolves to emitted JS and `.d.ts`. Needs `build` first, like SDK.
- `types/contributions.types.ts`: compile-time fixtures (unknown kind, view without `component`/`mount`, both, actions without `run`, toggle without `pressed`, wrong context type, `apiVersion: 2`, frame plugin without `attach`). Each `@ts-expect-error` verified to fire for the intended reason.

Commands:

- `pnpm --filter @histoire/plugin-kit build`: pass.
- `pnpm --filter @histoire/plugin-kit test`: pass (3 files, 20 tests; type fixtures pass).
- `pnpm --filter @histoire/shared build`: pass.
- `tsc --noEmit` in plugin-vue, -svelte, -react, -nuxt, -percy, -screenshot: pass (Node-only plugins unchanged).
- `pnpm --filter histoire build`: pass.
- `pnpm run lint`: fails with errors only in files outside this slice: `histoire-app/.../CanvasViewport.vue`, `canvas/frames/acquire-story-frame.ts` (concurrent slice 08 work) and `plans/workbench-plugins/public-api.md:141,144` (multi-space comments in code block). No errors in plugin-kit or shared.

Open issues:

- architecture.md surface table: toolbar path drifted to `histoire-app/src/app/components/canvas/toolbar/CanvasToolbar.vue` (groups at ~`:96-132`). Not edited (outside ownership).
- public-api.md should be updated with the refinements above and its two lint errors fixed.
