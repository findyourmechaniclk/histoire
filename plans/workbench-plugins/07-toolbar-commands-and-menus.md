# 07 — Toolbar, commands, shortcuts and menus

## Outcome and prerequisites

Depends on: 04, 05. One plugin action works consistently from toolbar, command search, shortcut and frame menu.

## Owned files

- `histoire-app/src/app/components/canvas/toolbar/CanvasToolbar.vue` (`:96-132`): plugin items per named group plus trailing `plugins` group, each in `BaseOverflowToolbarItem`.
- `components/canvas/toolbar/PluginToolbarItem.vue` (new): action/toggle via `ToolbarButton`, popover via `ToolbarPopover` with existing `open`/`setOpen`, custom via `ExtensionView`.
- `standalone/commands.ts` (`:52`): reactive map with `register()` merged into `list()`.
- `util/shortcuts.ts`: remove `reference` entry on dispose (`:100`); expose `register` to host. Standalone value; land early.
- `extensions/menus.ts` (new): adapters to `registerFrameAction` (`util/frame-actions.ts:105`) and `createContextMenu().register` (`composables/context-menu.ts:47`).

## Tests first

1. Toolbar item moved to overflow executes once against the correct context.
2. Popover closes and disposes its view when contribution is removed.
3. Plugin shortcut ignored in text inputs, respects focused scope, and a binding conflicting with a built-in is disabled with diagnostic while the command remains in search.
4. Frame-menu action runs against right-clicked frame without changing selection.
5. Capability filtering (e.g. dev-only, static book) hides the same action in toolbar, menu and command search.
6. Shortcut reference list in Settings drops plugin entries after teardown.

## Implementation steps

1. Toolbar group names become a documented list; unknown group falls back to `plugins`.
2. Commands: plugin commands visible in search when available; respect existing dev-only rule only for Node-backed commands.
3. Shortcut precedence: built-ins first; plugin conflicts rejected at registration.
4. Frame actions: wrap `run` with action runner so frame target is captured.
5. Context menu: plugins choose from existing `WorkbenchContextTarget` kinds; no arbitrary DOM targets.

## API changes

`toolbar.item`, `command`, `shortcut`, `frame-menu.item`, `context-menu.item` live.

## Failure paths

Action failure reported through invoking surface (toast or inline), no retry. Popover view failure isolated.

## Validation commands

~~~bash
pnpm --filter @histoire/app build
pnpm --filter histoire test:dev
~~~

## Acceptance criteria

Same plugin command executes once and identically from all four surfaces.

## Non-goals

Toolbar in `@histoire/vue` (`HistoireToolbar.ts`) until slice 13.

## Status

Prerequisite part only (shortcut `reference` leak), 2026-10-23.

- Landed: `histoire-app/src/app/util/shortcuts.ts` disposer also cleans `reference` when the disposed registration is still live: non-built-in ids are deleted; built-in ids are restored to canonical built-in metadata (a surface registering a built-in id directly, as `AppRail.vue` does for `global.theme`, no longer leaves its override behind). Stale disposers stay no-ops.
- `register` was already public on the registry; exposing it to the extension host stays with the rest of the slice.
- Test added: `histoire/src/node/__tests__/ui-shortcuts.spec.ts`, "drops disposed non-built-in shortcuts from the settings reference" (removal, stale disposer vs re-registration, built-in metadata restore).
- Commands: `pnpm --filter histoire test` pass (349 files, 1847 tests); `pnpm --filter @histoire/app build` pass; eslint on changed files pass.
- Open: everything else in slice 07.

### Full slice, 2026-10-23 (uncommitted)

Landed:

- Toolbar: `extensions/toolbar.ts` (`TOOLBAR_GROUPS` documented list in toolbar order, unknown group falls back to `plugins`; `listPluginToolbarItems` filters with `host.available` on the root context; `usePluginToolbar` revision bump on host notifications, keys follow contribution objects, no-op outside a workbench). `CanvasToolbar.vue` appends plugin items at the end of each group's `BaseOverflowToolbarItem`, adds a trailing `plugins` group, emits `error` (wired to the workbench boundary in `WorkbenchApp.vue`). `PluginToolbarItem.vue`: action/toggle through `ToolbarButton` (run once via `WorkbenchHost.run`, disabled while pending, `pressed` re-read on notifications and after each run), popover through `ToolbarPopover` sharing the toolbar's `open`/`setOpen` identity and popover scope, custom through `ExtensionView`; unmount releases the shared `open` id.
- Commands: `standalone/commands.ts` gains a reactive `register()` merged into `list()`; built-in and Node-backed commands stay dev-only in `list()` (gate moved out of `SearchPanel.vue`), registered plugin commands list in any source mode and execute their `clientAction` directly (no dev-command notification, no runtime ownership guard). `extensions/commands.ts` mirrors `command` contributions (`showIf` = host availability, `clientAction` = `WorkbenchHost.run`).
- Shortcuts: `util/shortcuts.ts` exports `ShortcutRegistry` and `builtinConflict(binding)`. `extensions/shortcuts.ts` registers plugin shortcuts in the existing registry (scopes, text-input guard, Settings reference); a binding overlapping a built-in (bound or not) or a live same-scope binding is not registered and becomes a diagnostic; its command stays available. Reference label is the command label.
- Menus: `extensions/menus.ts`. Frame-menu items become frame actions run against a frame scope of the right-clicked frame's own session (never the selection), retired when the action settles; availability evaluated against a short-lived frame scope. Context-menu items become `global` context actions filtered by `targets` kind, run with a serializable `ContextMenuContext.target` (no DOM refs) and the root scope.
- `extensions/sync.ts`: one mirror helper (identity diff of registry snapshots, removals first) shared by all adapters, plus `isContributionAvailable` so toolbar, menus, search and shortcuts use the same `host.available` rules. `extensions/action-surfaces.ts` installs the four adapters; called once from `standalone/workbench.ts` next to the host.
- Frame-menu child id scheme (slice 03 open issue): `${itemId}:${childId}` (`acme:export:json`). Local ids cannot contain `:`, so no collision with contribution ids. `ExtensionHost.run` resolves it (`plugin-kit/src/host/actions.ts` `resolveRunnable`) under the item's owner scope; diagnostics carry the child id. Documented on `ExtensionHost.run` and `FrameMenuChild.id`.

Deviations:

- Edits outside the listed files, kept minimal: `plugin-kit` `host/actions.ts`, `host/create-host.ts` (child resolution), `types/host.ts`, `types/menus.ts` (docs); `SearchPanel.vue` (dev gate moved into `list()`); `standalone/workbench.ts` (one adapter call; `WorkbenchApp.vue` cannot inject the host it provides).
- Shortcut conflicts and throwing toggle `pressed` callbacks are recorded through `host.reportViewError(id, error, 'report')`: the host has no app-side `register`/`callback` diagnostic API.
- Context-menu actions use the root (selection) scope per public-api.md; `ContextMenuContext.subscribe` is the root context's (not scope-owned).
- `ToolSwitch.vue` untouched (slice 08); plugin items in group `tools` render after it inside the same overflow item.

Tests:

- `plugin-kit/src/__tests__/host-run-children.spec.ts`: child run, attribution, removal.
- `histoire/src/node/__tests__/ui-extensions-shortcuts.spec.ts` (tests 3, 6), `ui-extensions-menus.spec.ts` (test 4, failure reporting, context-menu targets). Shared `utils/keyboard-event.ts` extracted from `ui-shortcuts.spec.ts`.
- `histoire-vue/src/__tests__/plugin-toolbar.spec.ts` (tests 1, 2, unknown group fallback), `plugin-actions-availability.spec.ts` (test 5 for `devOnly` and predicate across toolbar, frame menu, context menu, search; static plugin command runs once from `SearchPanel`).

Commands:

- `pnpm --filter @histoire/plugin-kit build`, `vitest run`: pass (10 files, 63 tests).
- `pnpm --filter @histoire/app build`: pass (first attempt hit `ENOTEMPTY` from a concurrent build).
- `histoire` `vitest run src/node/__tests__/ui-`: pass (37 files, 181). Full `pnpm --filter histoire test`: 15 timeouts in collection/build/test-runner specs (load average ~96), none touching changed code.
- `histoire-vue` full: 5 timeouts under load; the 3 affected files pass in isolation.
- `tsc -p tsconfig.workbench.json`: only pre-existing `App.vue` error and `extensions/shell-registry.ts` (slice 12, in progress). vue-tsc on `CanvasToolbar.vue`, `PluginToolbarItem.vue`, `SearchPanel.vue`: clean. eslint on changed files: clean.

Open issues:

- public-api.md should document the child id scheme and that plugin commands are not dev-only.
- No browser proof; slice 14 reference plugin should exercise all four surfaces.
- Shortcut hints are not shown on plugin toolbar items (toolbar items and commands are separate contributions).
