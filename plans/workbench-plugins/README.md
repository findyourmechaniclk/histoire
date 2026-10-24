# Workbench plugin system slice plans

Status: implementation complete, 2026-10-24. Slices 01–15, the gap fixes and a final pass landed uncommitted on `worktree-workbench-plugins` (base `main` 2387a19bf6dcf8c0a6382decac524670f72448f5). Local acceptance: every final command in [validation.md](validation.md) passes except one pre-existing flaky integration test (`canvas-content-sizing.spec.ts`, diagnosed in [evidence.md](evidence.md#final-pass-after-gap-fixes)); browser verification of overflow, narrow layouts, badges, custom view input and the Svelte 4 adapter done; gate results and remaining limitations in [conformance.md](conformance.md). Remote CI not run. No commit, push or publication done; each needs separate authorization.

## Intended outcome

Trusted npm or project-local plugins, enabled through existing Histoire config, contribute UI to the workbench and code to interactive story frames:

- Inspector tabs and sections inside existing tabs.
- Toolbar actions, toggles, popovers and custom items.
- Commands, keyboard shortcuts, frame and canvas context-menu entries.
- Rail panes, settings sections, home sections.
- Canvas overlays, tools, custom views alongside Grid/List/Matrix, managed story frames.
- Frame hooks inside interactive story frames, with scoped per-plugin host/frame messaging.
- Standalone Histoire, native Vue embedding (`@histoire/vue`) and generic DOM hosts. Native hosts import plugin UI explicitly.

Two first-class rendering paths, equal footing:

- **Workbench Vue components**: plugin SFCs compile against the workbench's bundled Vue (`@histoire/vendors/vue`) and may use `@histoire/controls` and shell components.
- **DOM mount**: `mount(el, context)` returning update/dispose, plus React, Svelte 4 and Svelte 5 adapters built on it.

Existing Node hooks, support plugins, story syntax, commands, routes and SDK behavior remain compatible.

## Read first

1. [Architecture, repository seams and corrections](architecture.md).
2. [Authoritative public API](public-api.md).
3. [Validation and acceptance matrix](validation.md).
4. Slice documents in dependency order. Supporting documents own shared contracts; slices must not redefine them.

## Slices and dependencies

1. [Contracts, package skeleton and baseline](01-contracts-and-package.md). Depends on none.
2. [Config resolution and browser manifests](02-config-and-manifests.md). Depends on 01.
3. [Extension host, registry and lifecycle](03-host-registry-and-lifecycle.md). Depends on 01.
4. [Rendering: workbench Vue, DOM mount and framework adapters](04-rendering-and-adapters.md). Depends on 02, 03.
5. [Scoped context, navigation and action services](05-context-and-actions.md). Depends on 03.
6. [Inspector tabs and sections](06-inspector-extensions.md). Depends on 04, 05.
7. [Toolbar, commands, shortcuts and menus](07-toolbar-commands-and-menus.md). Depends on 04, 05.
8. [Canvas geometry, overlays, tools and frame leases](08-canvas-primitives-and-frame-leases.md). Depends on 04, 05.
9. [Custom canvas views](09-custom-canvas-views.md). Depends on 08.
10. [Runtime purpose and frame-plugin lifecycle](10-frame-plugin-lifecycle.md). Depends on 01, 02.
11. [Frame messaging and SDK integration](11-frame-messaging-and-sdk.md). Depends on 03, 10.
12. [Rail, settings and home extensions](12-shell-settings-and-home.md). Depends on 04, 05.
13. [Standalone and embedding integration](13-host-integration.md). Depends on 06–12.
14. [Reference plugins and author documentation](14-examples-and-documentation.md). Depends on 13.
15. [Conformance, regression checks and handoff](15-conformance-and-handoff.md). Depends on 14.

## Milestones

- Foundation: 01–05 establish contracts, loading, per-workbench host, both rendering paths and scoped services.
- Workbench surfaces: 06, 07, 12 open closed shell and inspector lists through one registry.
- Canvas: 08–09 extract frame allocation and budget from components, then open overlays, tools and views.
- Frames: 10–11 add explicit runtime purpose, per-actor identity and per-plugin channels.
- Hosts and delivery: 13–15 unify `@histoire/vue` surfaces with the app registry, prove installed consumers and record conformance.

10 depends only on 01–02 and can run in parallel with 03–09 once source ownership is coordinated.

## Prerequisite fixes with standalone value

Each is owned by the slice named and is worth landing early on its own:

- Strip `plugins` from `virtual:$histoire-config` (02). Today plugin objects reach the browser and functions vanish only because JSON drops them.
- Remove shortcut `reference` entries on dispose (07).
- One `CanvasArrangement` source plus registry-backed guard; drop the five inline copies (09).
- Extract `acquireStoryFrame` from `CanvasReplicaPreview.vue` and add one frame-budget ledger per viewport (08).
- Explicit runtime purpose in story frames; `testWorker` is currently never read (10).

## Confirmed defaults

- Plugins are trusted code. No marketplace, runtime installer, built-in replacement API or automatic remote UI loading.
- Plugin `workbench` descriptor on the existing Node `Plugin`; key named `workbench` to avoid confusion with `HistoireConfig.ui`.
- `PluginCommand.clientSetupFile` stays supported and is reimplemented on top of the client manifest.
- One extension host per mounted workbench; nested selected-frame providers reuse it.
- Plugin-scoped JSON preferences; never part of "Save to project" in v1.
- Full workbench reload for plugin entry changes when Vite HMR cannot accept; no partial hot-swap contract.
- No commit, push, publish or deploy without separate instruction.

## Global implementation rules

- Preserve unrelated dirty, staged, untracked and concurrent changes.
- Authored source/test modules stay below 300 lines. Documentation exempt. Split by responsibility.
- JSDoc on functions, classes, types and properties; comment ownership, generation and cancellation logic.
- Write valuable behavior tests first. No CSS/class assertions, implementation-mirroring tests, duplicated fixtures or test count goals.
- Reuse existing registries (`createShortcutRegistry`, `createFrameActions`, `createContextMenu`, overflow toolbar, popover scope), serialization, rate limiting and test utilities. Never add a parallel copy.
- Empty, loading and error states for plugin areas use `WorkbenchEmptyState`, `WorkbenchLoadingState`, `WorkbenchErrorState`; busy indicators use `HstPulsatingDisc`. User-facing copy avoids the word "preview".
- Do not build on `StoryVariantGridSandbox` / `grid=true`; it is slated for removal.

## Non-goals

Marketplace or runtime install, replacing built-in surfaces, Shadow DOM isolation, project-config persistence for plugin settings or custom view defaults, relative-order dependency graphs between contributions, remote executable UI URLs in book descriptors, server-side rendering of plugin UI.
