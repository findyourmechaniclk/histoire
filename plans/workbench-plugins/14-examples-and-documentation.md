# 14 — Reference plugins and author documentation

## Outcome and prerequisites

Depends on: 13. Authors can build a plugin from public exports alone, in either rendering path.

## Owned files

- `examples/plugin-reference/` (new workspace package): one plugin covering inspector tab and section, toolbar command, frame-menu action, rail pane, settings section, home section, frame diagnostics via frame plugin and channel.
- Same package: comparison custom view with managed frames, lightweight annotation canvas tool.
- UI variants sharing one domain module: workbench Vue (SFC, precompiled), DOM, React, Svelte 5. Svelte 4 covered by adapter tests only.
- Wire into existing examples `examples/vue3`, `examples/react`, `examples/svelte4` through config.
- Docs: workbench plugin guide in existing `docs/guide/plugins/`; replace skeletal plugin API reference while keeping Node hook docs.

## Tests first

1. Packed reference plugin installs into a temp project without workspace aliases (reuse `test:embed:consumers` packing helpers).
2. React UI variant works in Vue story project; Vue variant works in React and Svelte story projects without `vue` installed by the project.
3. Browser options and preferences behave as documented.

## Implementation steps

1. Domain logic module framework-free; views thin.
2. Build step precompiles SFCs and JSX so consumers need no compiler.
3. Docs: lifecycle, capabilities, options exposure, theming and `overlayRoot`, frame execution limits and purposes, compatibility, Node-only restart note for plugin source changes.
4. Docs examples avoid the word "preview" in user-facing copy samples.

## API changes

None.

## Failure paths

Docs list each diagnostic phase and what users see.

## Validation commands

~~~bash
pnpm --filter histoire test:embed:consumers
pnpm run docs:build
~~~

## Acceptance criteria

Examples cover every contribution kind and both rendering paths without production scanner dependencies.

## Non-goals

Publishing the reference plugin.

## Status

Landed 2026-10-24 (uncommitted).

### Reference plugin (`examples/plugin-reference`, private workspace package `histoire-example-plugin-reference`)

- Node entry `referencePlugin({ ui, minTargetSize, devOnly })` (`src/node.ts`, emitted by `tsc`): descriptor `id: 'reference'`, client entry per UI variant, frame entry, JSON options. Entries resolved with `fileURLToPath(new URL(...))`.
- Domain (framework-free, `src/domain/`): `audit.ts` (missing alt, unnamed control, small target), `audit-store.ts` (one channel per attached actor, `audit`/`highlight` requests), `preferences.ts` (badges, annotations), `annotation-draft.ts` (tool gesture), `titles.ts` (catalog titles), `view-state.ts`/`format.ts` (what every view shows, identical copy across variants).
- Frame plugin (`src/frame/`): audits on attach, DOM mutations and state changes (one per animation frame), answers `audit`, outlines issue elements on `highlight`, cleans up on detach.
- Contributions (`src/workbench/`), identical for all variants: inspector tab + section (`builtin:props` after), toolbar action/toggle/popover, two commands, global shortcut (`alt+shift+b`), frame-menu item with two children, story context-menu item, rail pane, settings section, home section, canvas-space annotation overlay, per-frame issue badge, annotation tool (`a`), Compare view leasing one frame per variant (`queue`, view-lifetime signal, `layout` for Fit, `toolbar` groups).
- UI variants, four panel views each: workbench Vue SFCs (`@histoire/controls/vue` `HstButton`/`HstSwitch`/`HstPulsatingDisc`, `useWorkbenchContext`), DOM, React (`reactView`, JSX), Svelte 5 (`svelte5View`). Canvas views are shared DOM mounts. Precompiled by `vite build` (library mode, `@vitejs/plugin-vue`, `svelte/compiler`, oxc JSX); stylesheet inlined (`?inline`) and injected once per page (ref-counted). Consumers need no compiler or CSS pipeline.
- Wiring: `examples/vue3` React UI (override with `HISTOIRE_REFERENCE_UI=vue|dom|svelte`, `minTargetSize: 40` so BaseButton variants report), `examples/react` Vue UI (no `vue` installed), `examples/svelte4` DOM UI (Svelte 5 adapter cannot run there: `vite-plugin-svelte` dedupes `svelte` to the project's Svelte 4). `histoire.docs.config.ts` filters the plugin out of the public demo. Root `build` script also builds `./examples/plugin-reference`.

### Docs

- New `docs/guide/plugins/workbench.md` (anatomy, descriptor, lifecycle and restart rules, contribution table, both rendering paths, workbench Vue limits, adapters, theming/`overlayRoot`, contexts/capabilities, options vs preferences, canvas, frame plugins and purposes, channels, embedding hosts, diagnostics table, compatibility). Sidebar entry added; `development.md` links it.
- `docs/reference/plugin-api.md` rewritten: Node hooks (previously undocumented there), descriptor, plugin-kit entries, API, contribution fields, views, contexts, frame plugin, channel, diagnostics.

### Fixes outside the example (real bugs hit during browser/consumer runs)

1. Toolbar toggles stayed stale after a preference write from another surface (settings switch, shortcut). `plugin-kit` `host/preferences.ts`, `host/create-host.ts`: preference writes notify host subscribers. Test: `preferences.spec.ts` "notifies host subscribers after a write…" (failed before).
2. Plugin failures were invisible in the standalone workbench (a duplicate contribution id silently removed the whole plugin). App `extensions/create-workbench-host.ts`: each new diagnostic is logged once as `[histoire plugin "<id>"] <phase> failed:` (`error` option, defaults to `console.error`). Test: `ui-extensions-services.spec.ts` (+ `utils/workbench-extensions.ts` passes an `error` spy).
3. React views of an installed (npm) plugin failed in dev: `react` (CommonJS) imported from a `node_modules` plugin file was served raw ("does not provide an export named 'createElement'"). `histoire/src/node/vite/workbench-vue.ts`: non-Vue bare imports from marked importers inside `node_modules` are registered with the dev dependency optimizer. Test: `workbench-vue.spec.ts` "prebundles CommonJS dependencies of installed plugin packages" (failed before). Supersedes the slice 04 limit.
4. Test helper `utils/package-consumer.ts` also packs workspace packages under `examples/`.

### Tests

- `examples/plugin-reference/src/__tests__/audit.spec.ts` (rules, rendered-size filter, JSON report) and `variants.spec.ts` (every variant registers all 14 kinds with identical ids; DOM/React/Svelte views render a channel report, highlight request, option value and preference toggle; mutation-checked).
- `packages/histoire/src/node/__tests__/embed/consumers/plugin-reference.spec.ts` (+ `utils/embed/reference-plugin-consumer.ts`): packed plugin + packed Histoire in temp projects. Vue project, React UI, dev: installed from tarball, no source files shipped, audit findings (frame plugin, channel, `minTargetSize` option), preference persisted across reload under the project/plugin namespace, config untouched. React project without `vue`, Vue UI, static: findings and workbench `HstButton`.

### Browser proof (`examples/vue3` dev server from this worktree, built-in browser)

Screenshots in `plans/workbench-plugins/evidence/`: React variant inspector tab + frame badges, toolbar items, popover, rail pane, settings section, home section, annotation tool + canvas overlay following zoom, frame menu children, story context menu, Compare view with leased frames and issue chips, command search; Vue variant tab and popover (workbench controls); Svelte 5 and DOM variants; light theme. Verified by script: highlight outline applied inside the right frame, shortcut toggles badges, preference stored as `_histoire-ui:<book>:plugin:reference:badges`, annotation stored in canvas units and scaled with zoom, Clear annotations command empties it, Compare variants opens `?arrange=reference:compare`.

### Commands

- `pnpm install --prefer-offline`: pass.
- `pnpm --filter histoire-example-plugin-reference build` / `test`: pass (2 files, 7 tests); `tsc --noEmit`: clean.
- `pnpm --filter @histoire/plugin-kit build` / `test`: pass (12 files, 71).
- `histoire` `vitest run src/node/__tests__/ui-`: pass (38 files, 188); `workbench-vue.spec.ts`, `workbench-vue-sfc.spec.ts`: pass (8).
- `histoire-vue` `vitest run plugin workbench-plugin extension native-extensions inspector-extensions`: pass (12 files, 49).
- `pnpm --filter @histoire/app build`, `pnpm --filter histoire build`: pass. `tsc -p histoire-app/tsconfig.workbench.json`: only the pre-existing `../App.vue` error.
- `story:build`: `examples/react` pass, `examples/svelte4` pass, `examples/vue3` fails with `[md] Cannot find story file: ../MarkdownFile.story.md` from `MarkdownLinks.story.vue`; the same failure reproduces with the reference plugin filtered out (pre-existing, unrelated).
- eslint on changed files: clean.
- `pnpm --filter histoire test:embed:consumers`: pass (3 files, 7 tests: `packages`, `nuxt-package`, `plugin-reference`). The first run of the new spec failed on fix 3 above (React CommonJS served raw); passes after it.
- `pnpm run docs:build`: pass (demo built without the reference plugin, VitePress build complete).

### Open issues

- `api.frames` has no attach/detach notification; the reference plugin polls `list()` every 750 ms while a view observes it. A `frames.subscribe` would remove the polling.
- Workbench state components (`WorkbenchEmptyState`, `WorkbenchLoadingState`, `WorkbenchErrorState`) are not exported to plugins; plugin views use their own empty text and `HstPulsatingDisc` (Vue variant only).
- Plugin settings sections render inside the settings page padding plus the view's own gutter; there is no exported pane/settings layout primitive.
- Tab and rail `badge` functions are not re-read on plugin state changes outside the host (the reference plugin shows counts in views and frame overlays instead of badges).
- public-api.md could record: preference writes notify the host; standalone diagnostics logging; installed plugin CommonJS prebundling.
