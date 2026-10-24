# 12 — Rail, settings and home extensions

## Outcome and prerequisites

Depends on: 04, 05. Plugins add rail panes, settings sections and home sections without editing built-in components.

## Owned files

- `stores/shell.ts:5,35`: `ShellPane` becomes built-in union plus qualified string; `isShellPane` consults registry after `ready`; persisted value (`_histoire-ui-shell`) normalized after `ready`.
- `components/shell/rail-items.ts:21`, `AppRail.vue:39-56`: merge plugin rail items with badges.
- `ShellLayout.vue:75`: dynamic slot fallback renders `ExtensionView` for plugin panes.
- `standalone/workbench-navigation.ts:5`: `WorkspacePane` widened.
- `stores/settings.ts:26,38`, `SettingsPage.vue:11-24`, `SettingsNav.vue:13`: section registry; router guard (`standalone/navigation.ts:18-22`) uses lazy lookup.
- `components/pages/home/HomePage.vue:80-93`: column outlets after built-in sections.

## Tests first

1. Plugin rail pane opens from rail and from Settings-to-workspace navigation; restores focus on close.
2. Persisted plugin pane that no longer exists recovers to Stories after `ready`.
3. `/settings/<plugin>:<id>` resolves, or falls back to Appearance after `ready`.
4. Plugin preferences changed in its settings section stay plugin/project scoped and never enter "Save to project".
5. Static book omits dev-only rail panes and home sections.

## Implementation steps

1. Registry-backed guards with pre-`ready` loading state instead of eager fallback.
2. Reuse panel resizing and narrow layout behavior; plugin panes use `WorkbenchPaneHeader`, `WorkbenchPaneToolbar`, `WorkbenchPaneList` when Vue.
3. Icons: offline Carbon glyph names validated against `histoire-shared/src/icons/icon-names.json`.

## API changes

`shell.pane`, `settings.section`, `home.section` live.

## Failure paths

View failure isolated with `WorkbenchErrorState`; rail item remains.

## Validation commands

~~~bash
pnpm --filter @histoire/app build
pnpm --filter histoire test:dev
~~~

## Acceptance criteria

A plugin uses all three shell surfaces without modifying built-in components.

## Non-goals

Plugin-defined home layout; reordering built-ins.

## Status

Landed 2026-10-23 (uncommitted).

- `extensions/shell-registry.ts` (new): `ContributionPresence` (`available`/`pending`/`missing`), `isPluginContributionId`, `createContributionLookup(workbench, kind)` (lazy `host.available` reads in the root context, so `devOnly` and `available` predicates apply; `pending` only until `host.ready`; subscribers also notified on readiness), `createEmptyContributionLookup`, `contributionKey` (render key per contribution object).
- `extensions/icons.ts` (new): `resolveContributionIcon` validates against `histoireIconNames` (generated from `icon-names.json`), falls back to `plug` with one warning per contribution. Reusable by 06/07/09.
- `composables/shell-extensions.ts` (new): `useOptionalExtensionHost`, `useContributionLookup(kind)` (Vue-tracked reads, subscription tied to scope).
- `stores/shell.ts`: `ShellPane = BuiltinShellPane | PluginShellPane`; `isShellPane(value, dev, panes?)` registry-backed; `bindPanes(registry)`; restored plugin pane kept while pending or unbound, normalized to Stories once missing (setup settled, removed, dev-only in static). `WorkspacePane` widens through `ShellPane`.
- `ShellLayout.vue` binds the registry; dynamic slot fallback renders `PluginPane.vue` (new): `WorkbenchPaneHeader` + `ExtensionView`, `WorkbenchLoadingState` before ready. `AppRail.vue` + `rail-items.ts`: plugin items after built-ins, badges (failure reported once via `reportViewError`, badge hidden).
- `stores/settings.ts`: `normalizeSettingsSection(section, dev, sections?)`; `defaultArrange`/`setArrange` use `CanvasDefaultArrangement`. `standalone/navigation.ts`: guard reads a lazily bound registry via `bindSettingsSections(registry)`; unbound (initial deep link before the workbench mounts) plugin ids pass. `SettingsPage.vue`/`SettingsNav.vue`: plugin sections after built-ins, loading state while pending, emits `appearance` once missing; plugin sections never render `SaveToProject`.
- `HomePage.vue` + `PluginHomeSections.vue` (new): `ExtensionOutlet` per column after built-ins.

Deviations / minimal touches outside listed ownership:

- `extensions/standalone.ts`: binds the settings lookup to `props.navigation` (only place holding both host and router; `WorkbenchApp.vue` cannot inject the host it provides itself).
- `SidePanelHost.vue`: optional `label` prop for the region name. `RailButton.vue`: `badge` accepts strings, `accent` tone for plugin badges.
- `WorkbenchApp.vue` and `create-workbench-host.ts` untouched. `workbench-navigation.ts` needed no edit.

Tests:

- `histoire-vue/src/__tests__/workbench-plugin-shell.spec.ts`: rail open inside pane layout + focus restore on close, Settings-to-workspace activation, pre-ready loading then Stories recovery, static book omits dev-only pane and recovers a persisted one.
- `histoire-vue/src/__tests__/workbench-plugin-settings.spec.ts`: pending section loads then renders after built-ins, missing section falls back to Appearance after ready, plugin preference stored under project+plugin namespace with no project save action.
- `histoire/src/node/__tests__/ui-shell-extensions.spec.ts`: guard pending/available/missing, unbound guard, icon validation.

Commands:

- `pnpm --filter @histoire/app build`: pass.
- New specs + related histoire-vue (`standalone-shell`, `workbench-*`, `extension-outlet`, `source-expansion`, `panel-resize`; 45 files): pass. histoire `ui-*` (37 files): pass.
- Full `histoire-vue` suite: a few timeouts under concurrent load (including other slices' specs), all pass in isolation.
- vue-tsc on changed files: clean, except errors in other slices' in-progress files (`extensions/sync.ts`, `embed/adapters/channels.ts`, `CanvasViewport.vue`). eslint on changed files: clean.
- `test:dev` is watch mode; covered by the runs above.

Open issues:

- `navigation.openPane` on an already open pane toggles it closed (existing `activatePane` toggle semantics in `workbench.ts`, same for built-ins).
- Navigation adapter validates plugin targets with `host.contributions`, not `available`; a dev-only pane opened in a static book is ignored by the shell guard without a warning.
- Plugin badges re-evaluate on registry/context changes or reactive (vendor Vue) reads; no explicit invalidation API.
- Shell pane components are not exported to plugins; plugin pane bodies sit under a host-rendered `WorkbenchPaneHeader`. Slices 13/14 decide exports.
