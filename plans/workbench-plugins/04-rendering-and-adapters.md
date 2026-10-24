# 04 — Rendering: workbench Vue, DOM mount and framework adapters

## Outcome and prerequisites

Depends on: 02, 03. Every view contribution renders through one outlet that accepts either a workbench Vue component or a DOM `mount`. React, Svelte 4 and Svelte 5 adapters build on `mount`.

## Owned files

- `histoire/src/node/vite/workbench-vue.ts` (new): importer-scoped resolution of `vue` for plugin client graphs.
- `histoire-plugin-kit/src/render/mount-manager.ts`: DOM mount lifecycle (abort, late-completion disposal, update, error capture).
- `histoire-plugin-kit/src/vue/`: `useWorkbenchContext`, component typing helpers; `vue/mount.ts` (`vueView` isolated-app adapter).
- `histoire-plugin-kit/src/react/`, `svelte4/`, `svelte5/`: adapters.
- `histoire-app/src/app/components/extensions/ExtensionView.vue`: renders one contribution; uses `WorkbenchLoadingState` while pending and `WorkbenchErrorState` on failure.
- `histoire-app/src/app/components/extensions/ExtensionOutlet.vue`: renders ordered contributions for a placement.

## Workbench Vue resolution (spike first)

Problem: plugin modules compiled by the project's Vite import the project's `vue`; the workbench uses `@histoire/vendors/vue`. Components must share the workbench instance (reactivity, provide/inject, `@histoire/controls`).

Spike both, pick one, record outcome in this file:

- **A. Marked subgraph.** Manifest imports entries with a marker query. A `resolveId` hook propagates the marker to every module resolved from a marked importer and resolves `vue`, `vue/*`, `@vue/*` to vendor paths. Shared modules get a distinct marked instance, so story graphs stay untouched. Risks: SFC sub-request queries (`?vue&type=`), dependency optimizer prebundling `vue` imports in shared deps, duplicate module instances.
- **B. Separate compile.** Plugin client entries built by a dedicated Vite environment (dev) / library build (static) with `vue` external, mapped to the vendor chunk. Risks: second pipeline, HMR wiring, build time.

Constraints for both: precompiled npm plugins (JS importing `vue`) must work in React and Svelte story projects with no `vue` installed; project-local `.vue` sources require the project to have `@vitejs/plugin-vue` (no compiler added implicitly); `@histoire/controls/vue` imported from plugin code resolves to the workbench copy.

## Tests first

1. Vue component contribution receives updated `context` prop without remount; component state survives context updates.
2. DOM mount: `update` called with new context; `dispose` on scope retirement; pending mount resolved after retirement is disposed immediately and never attached.
3. Mount or update throw shows error state only for that contribution; siblings keep rendering.
4. React, Svelte 4, Svelte 5 adapters mount, update and unmount their root; cleanup removes listeners and portals placed in `overlayRoot`.
5. Importing `/react` never loads `svelte` or `vue`, and vice versa.
6. Browser fixture: precompiled Vue plugin in a React story project renders, uses `HstButton`, and shares the workbench theme.
7. Plugin Vue component injecting a workbench-provided key resolves it (proves single instance).

## Implementation steps

1. Run spike; document choice and rejected alternative.
2. Mount manager per outlet slot: holds generation token, handle, last context; serializes update after mount completion.
3. Theme: outlet container inherits workbench CSS variables; `overlayRoot` is a host element inside the workbench theme scope.
4. Adapters: React `createRoot` per container, Svelte 4 `new Component({ target, props })` + `$set`, Svelte 5 `mount`/`unmount` with reactive props object.
5. CSS: document scoping expectations; no Shadow DOM.

## API changes

`ContributionView` both variants, adapters per public-api.md.

## Failure paths

Spike shows neither strategy works for SFC subrequests: fall back to supporting only precompiled Vue plugins in workbench-Vue mode and document it; DOM mount stays unaffected.

## Validation commands

~~~bash
pnpm --filter @histoire/plugin-kit test
pnpm --filter @histoire/app build
pnpm --filter histoire build
pnpm --filter histoire test:dev
~~~

## Acceptance criteria

Plain DOM, workbench Vue, React, Svelte 4 and Svelte 5 views mount, update, fail locally and dispose correctly, in dev and static builds.

## Non-goals

Shadow DOM, sharing framework context across adapters.

## Status

Landed 2026-10-23 (uncommitted).

### Spike outcome: strategy A (marked subgraph) chosen

`histoire/src/node/vite/workbench-vue.ts`, registered as the `resolveId` hook (`order: 'pre'`) of the core plugin (`vite/core-plugin.ts`, one import plus one line).

- Modules imported from `/__resolved__virtual:$histoire-workbench-plugins`, and from any marked module, get a `histoire-workbench` query inserted right after `?` (never last, so `lang.ts`, `lang.css` suffix checks keep working). Same file reached from story code keeps its unmarked id and the project's resolution.
- In a marked graph: `vue`, `@vue/runtime-dom|runtime-core|reactivity` resolve through `this.resolve('@histoire/vendors/vue', <app bundled index.js>)`, so the id (and the dev module-version `?v=hst-` URL) is exactly the workbench's. `@histoire/controls/vue` resolves to the controls copy bundled in the app dist. Other `vue/*` subpaths fail with an explicit error (vendor build is runtime-only).
- Packages declaring `vue` in dependencies/peer/optional (and `@histoire/plugin-kit/vue*`) resolve through `config.createResolver()` (no optimizer) and stay marked; other packages (React, utilities) resolve normally and are shared. Prebundled ids, the app package and vendors are never marked. SFC style sub-requests and `?raw|url|inline|worker` are not marked.
- Optimizer scan: plugin files are tracked in a set (scan ids are unmarked); Vue ids and Vue-dependent packages imported from them are returned as externals so the scan never registers `vue` or `@histoire/plugin-kit/vue` (that prebundle would fail without `vue`).
- Project-local `.vue` sources work in dev and static builds when the project has `@vitejs/plugin-vue` (script setup + TS + scoped style tested). No precompiled-only fallback needed.

Rejected: strategy B (separate compile). Needs a second Vite pipeline per mode, HMR bridging into the workbench graph, and a vendor-chunk mapping for static builds, while A reuses the project's own plugins (plugin-vue, aliases) and needs one resolver hook.

Limits: third-party Vue libraries that do not declare `vue` are prebundled with the project's `vue`; CJS dependencies of plugin packages installed in `node_modules` are not optimized (normal Vite behavior for non-optimized importers); runtime template compilation unavailable.

### Rendering

- `plugin-kit/src/render/mount-manager.ts`: per-view generation scope linked to the owner; coalesced updates applied after mount; late completion after retirement disposed, never updated; mount/update failures reported and local; failed update disposes the view.
- `plugin-kit/src/host/mount.ts` + `create-host.ts`: `ExtensionHost.mount` implemented; failures recorded as `mount`/`update`/`dispose`/`report` diagnostics.
- `plugin-kit/src/render/view-binding.ts`: `WORKBENCH_VIEW_KEY` (`Symbol.for`, shared across plugin-kit copies) + `WorkbenchViewBinding`, exported from root.
- `/vue`: `useWorkbenchContext()` (live proxy over the current snapshot), new `useViewHost()`. `/vue/mount`: `vueView` isolated app. `/react`: `reactView` (`createRoot`, `flushSync` renders, props `{ context, host }`). `/svelte4`: `svelte4View` (no svelte import). `/svelte5`: `svelte5View` (`mount`/`unmount`, `context` getter backed by `createSubscriber`).
- App: `components/extensions/ExtensionView.vue` (component views get `context` prop + binding provide, `onErrorCaptured` boundary; DOM views via `host.mount`; `WorkbenchLoadingState`/`WorkbenchErrorState` defaults, overridable slots), `ExtensionOutlet.vue` (ordered `host.available`, rerender on host notifications, `#pending` slot until `ready`, keys follow contribution objects), `view-host.ts` (overlay root appended inside nearest `.histoire-app`/`.histoire-workbench`/`.histoire-root`, removed on unmount). Both use `useExtensionHost().host` from slice 05 unless a `host` prop is given.
- CSS: no Shadow DOM. Plugin views and overlay roots sit inside the workbench theme scope and inherit `--histoire-*` variables; plugins scope their own styles (SFC `scoped`, prefixed classes). Slice 14 documents it for authors.

### Deviations

- Types: `ExtensionHost.mount` gains optional `ViewMountOptions` (`overlayRoot`, `onError`); new `ExtensionHost.reportViewError(id, error, phase)` for app-rendered Vue views; new `ViewFailurePhase`. Adapter view components receive `{ context, host }`. public-api.md not updated (outside ownership).
- Svelte peer range raised to `^4.0.0 || ^5.7.0` (`createSubscriber`).
- `ExtensionView`/`ExtensionOutlet` are not imported by any surface yet, so they are absent from the app dist until slices 06/12 use them.
- Added `histoire-plugin-kit/vitest.config.ts` (compiles `*.v4.svelte` with the `svelte4` alias package, `*.v5.svelte` with Svelte 5; `browser` condition).

### Tests

- `histoire/src/node/__tests__/workbench-vue.spec.ts` (+ `utils/workbench-vue-project.ts`): dev URLs identical to the workbench's vendor Vue and controls, with and without project `vue`; story-side copy unaffected; plugin-kit/vue and a third-party Vue library marked; `vue/server-renderer` rejected; optimizer scan clean; static build executed in Node shares the vendor `ref`.
- `workbench-vue-sfc.spec.ts`: project-local SFC in dev (style sub-request served) and build (single Vue runtime in output).
- `embed/integration/workbench-vue-plugin.spec.ts`: React example project without `vue`, installed precompiled Vue plugin, dev and static: plugin `inject` reads the workbench app provides (single instance), `HstButton` renders with workbench theme variables, no page errors. Fails with the resolver removed (checked).
- `plugin-kit`: `host-mount.spec.ts`, `adapters.spec.ts` (React, Svelte 4, Svelte 5, isolated Vue: mount, update without remount, listener and portal cleanup), `imports.spec.ts` adapter graph isolation, type fixtures for adapters.
- `histoire-vue/src/__tests__/extension-outlet.spec.ts`: live context without remount + workbench injection, local failures with sibling rendering, diagnostics, DOM view disposal, late registration/removal.

### Commands

- `pnpm install --prefer-offline`: pass (first run was a no-op before the package.json edit landed; second installed the devDependencies).
- `pnpm --filter @histoire/plugin-kit build` / `test`: pass (9 files, 61 tests; type fixtures pass).
- `pnpm --filter @histoire/app build`: pass. `pnpm --filter histoire build`: pass.
- `pnpm --filter histoire test`: pass (360 files, 1920 tests).
- `vitest run --config vitest.embed.config.ts workbench-vue-plugin.spec.ts`: pass (2).
- `histoire-vue` `extension-outlet.spec.ts`: pass (3). vue-tsc on `components/extensions`: pass. eslint on changed files: clean.
- `test:dev` is watch mode; covered by `test`.

### Open issues

- public-api.md should list `ViewMountOptions`, `reportViewError`, `useViewHost`, `WORKBENCH_VIEW_KEY`, adapter props `{ context, host }`.
- Static browser proof relies on slice 05 importing the manifest in `standalone/mount.ts`; outlets are not placed in surfaces yet (06/12), so the proof mounts the plugin component by hand in the workbench page.
