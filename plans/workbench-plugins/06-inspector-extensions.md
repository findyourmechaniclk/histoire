# 06 — Inspector tabs and sections

## Outcome and prerequisites

Depends on: 04, 05. Plugins add inspector tabs and sections before/after any tab body, plus an inspector footer before the Source drawer. Built-in tabs become registry descriptors.

## Owned files

- `histoire-app/src/app/components/inspector/state.ts`: replace closed `InspectorTab` union, `getInspectorTabs` (`:12`) and `normalizeInspectorTab` (`:17`) with built-in descriptors plus registry lookup.
- `StoryInspector.vue` (`:108-135` `v-if` chain): render active tab via descriptor component or `ExtensionView`; section outlets around body; footer outlet.
- `InspectorTabs.vue` (`:40-47` hard-coded badges): badges from descriptors.
- `PropsTab.vue`: keep `matrix` slot.

## Tests first

1. Plugin tab deep link `?tab=<plugin>:<id>` survives startup (before `ready`) and reload.
2. Removing the active plugin tab moves to Props and restores focus to the tab list.
3. Section receives selected-frame context and updates across Grid and Matrix selection changes.
4. Built-in docs navigation from search (`standalone/commands.ts:65`), events count badge, controls and Source drawer behave as before.
5. Two inspectors (standalone plus nested provider) keep independent active state and unique ARIA ids.
6. Tab `available` false hides tab and falls back like removal.

## Implementation steps

1. Built-in descriptors `builtin:props|docs|events|tests` map to existing values `''|docs|events|tests`; URL keeps legacy values.
2. Normalization waits for host `ready` before rewriting unknown values; before that, render loading state for unknown plugin tab.
3. Keyboard navigation and overflow follow existing tab list implementation; plugin tabs append after built-ins by order.
4. Coordinate with `plans/devframe-inspection/11`: new built-in panels register as descriptors here.
5. `@histoire/vue` `ExplorerPanels.ts` stays unchanged until slice 13.

## API changes

`inspector.tab`, `inspector.section` contributions live.

## Failure paths

Tab view failure: `WorkbenchErrorState` inside tab; tab stays selectable. Section failure isolated.

## Validation commands

~~~bash
pnpm --filter @histoire/app build
pnpm --filter histoire test:dev
pnpm --filter @histoire/vue test
~~~

## Acceptance criteria

New tabs and sections in built-in tabs work using public plugin-kit exports only.

## Non-goals

Replacing built-in tabs; native explorer panels (13).

## Status

Landed 2026-10-23 (uncommitted).

- `histoire-app/src/app/components/inspector/`:
  - `state.ts`: `InspectorTab` is now `string` (legacy value or qualified plugin id). `INSPECTOR_BUILTIN_TABS` (`builtin:props|docs|events|tests` mapped to `''|docs|events|tests`) is the single built-in identity/order list; `getInspectorTabs`/`normalizeInspectorTab` kept. New `resolveInspectorTab` (legacy values unchanged; plugin id shown when available, `pending` before `ready`, `rewrite` to Props after `ready`; `builtin:<x>` maps to its legacy value), `getInspectorTabId`, `getInspectorTabKey`, `InspectorTabItem`.
  - `builtins.ts`: `INSPECTOR_BUILTIN_VIEWS` (body + optional badge component per built-in). New bodies `DocsTab.vue`, `EventsTab.vue`, `TestsTab.vue` (moved from the `v-if` chain), badges `EventsBadge.vue`, `TestsBadge.vue` (moved from `InspectorTabs.vue`). `PropsTab.vue` unchanged (keeps `matrix` slot).
  - `model.ts`: per-inspector provide/inject model (docs anchor, events, unseen count, tests state); `useInspectorTestsState` moved out of `StoryInspector.vue`.
  - `plugin-tabs.ts`: `useInspectorExtensions(snapshot)`: selected-frame context (previous context kept while the next frame loads so views update instead of remounting; `null` without a selected variant), plugin tabs via `host.available` (registered + `devOnly` filter while no frame context exists), badges (throwing badge hidden for good, reported through `reportViewError`).
  - `StoryInspector.vue`: built-in body via `<component :is>`, plugin tab body via `ExtensionOutlet` (so the `ExtensionView` error state stays inside the tab), section outlets before/after the body, footer outlet before `SourceDrawer`. Pending deep link shows `WorkbenchLoadingState` with `aria-busy`, no tab selected. Fallback watcher (pre-flush) rewrites the route to Props and moves focus to the Props tab when the removed tab or its panel held focus. Plugin tab without admitted frame: loading state while a variant loads, else "Select a variant" empty state.
  - `InspectorTabs.vue`: renders `tabs: InspectorTabItem[]`; badges from descriptors (component or plugin text); keyboard navigation over built-ins then plugin tabs. ARIA ids `${useId()}-tab|panel-${key}`; built-in keys unchanged, plugin keys are qualified ids.
- `extensions/navigation.ts`: `builtin:` inspector ids map through `INSPECTOR_BUILTIN_TABS`.

Deviations:

- Built-in tabs stay app-local descriptors (`INSPECTOR_BUILTIN_TABS` + `INSPECTOR_BUILTIN_VIEWS`), not `registerBuiltin` entries. Reasons: built-ins render without a selected frame (Props "Select a variant", Docs of docs-only stories) while `host.available` needs a `FrameScopedContext`; Tests visibility follows the provider snapshot source plus dev build, not a context predicate; bodies/badges need per-inspector state (docs anchor, matrix slot, unseen counter, project test cache) the `{ context }` view contract cannot carry; registering from each inspector would throw on duplicates, and registering in shared `create-workbench-host.ts` would add registry entries no consumer reads. `devframe-inspection/11` adds a built-in panel by adding one entry to both maps; no template branch.
- `resolveInspectorTab` rewrites only qualified plugin ids; unknown non-qualified legacy values keep today's behavior (Props shown, URL untouched).
- Footer sections ignore `position` (all render in the footer, registry order).

Tests:

- `histoire/src/node/__tests__/ui-inspector.spec.ts`: resolution rules (legacy values, pending before ready, rewrite after ready, `builtin:` ids).
- `histoire-vue/src/__tests__/inspector-extensions.spec.ts` (+ `fixtures/story-inspector.ts`, reusing `createTestWorkbenchHost`, `pluginEntry`, `createSnapshotSession`, `sourceFixture`, `deferred`): deep link before `ready` and after remount; legacy `tab=events` plus plugin tab/badge in keyboard order; removal falls back to Props with focus restore; `available` false falls back; sections before/after/footer order relative to body and Source, context update without remount across selection change; two inspectors keep independent state and unique, consistent ARIA ids.
- `histoire/src/node/__tests__/embed/integration/inspector-plugin-tab.spec.ts`: project-local plugin with slow setup, dev (history router) and static (hash router): `?tab=probe:panel` survives startup and reload, footer section renders, `probe:missing` rewrites to Props after setup.

Commands:

- histoire-vue `vitest run inspector-extensions.spec.ts`: pass (6). Neighbours `extension-outlet`, `standalone-docs-links`, `source-expansion`: pass.
- histoire `vitest run ui-inspector ui-extensions-services ui-extensions-scopes`: pass.
- histoire `vitest run --config vitest.embed.config.ts inspector-plugin-tab.spec.ts`: pass (2).
- `pnpm --filter @histoire/app build`: pass.
- `pnpm --filter @histoire/vue test`: 711 pass, 2 fail in `plugin-toolbar.spec.ts` (slice 07, in progress).
- `pnpm --filter histoire test`: 1912 pass; 8 failures + 5 file-level errors outside this slice: concurrent `@histoire/app` dist rebuilds (`Cannot find package '@histoire/app/dist/embed/capabilities.js'`, unloadable dist file in `workbench-vue.spec.ts`), hook timeouts (`test-lifecycle`, `test-specs`, `test-targeting`, `mcp/test-cancellation`, `vite.spec`), `ui-extensions-menus.spec.ts` (slice 07).
- vue-tsc `tsconfig.workbench.json`: inspector clean; remaining errors in `CanvasViewport.vue`, `ToolSwitch.vue`, `plugin-tools.ts`, `shell-registry.ts` (other slices).
- eslint on changed files: clean.

Open issues:

- Tab overflow: plugin tabs share the fixed button group (existing tab list has no overflow). Plugin `icon` is not rendered; labels only, matching built-ins.
- `test:dev` is watch mode; covered by `test`.
- public-api.md could note that built-in inspector tabs are app-local descriptors, not registry entries.
