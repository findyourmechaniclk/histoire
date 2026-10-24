# Architecture, repository seams and corrections

Paths are relative to `packages/` unless noted. Line numbers reflect commit 2387a19b and drift; re-verify before editing.

## Corrections to the salvaged plan

1. **Plugin objects already reach the browser.** `histoire/src/node/virtual/resolved-config.ts:5-11` strips only `agents`, `browser`, `comments` and agent preset `env`, then `JSON.stringify(config)`. `plugins` (and object-valued `vite`) are serialized; functions vanish only as a JSON side effect. Slice 02 adds an explicit strip before any browser-visible plugin options exist.
2. **Vue is not shared.** The workbench runs on `@histoire/vendors/vue` (aliased in `histoire-app/vite.config.ts:42-54`). Plugin modules compiled by the project's Vite import the project's `vue`, which may be absent in React/Svelte projects. `dedupe: ['vue']` (`histoire/src/node/vite/core-plugin.ts:61`) does not merge them. Slice 04 owns importer-scoped resolution so plugin workbench components share the vendor Vue.
3. **Virtualized grid is legacy.** `StoryVariantGridSandbox` (`histoire-app/src/app/components/story/StoryVariantGridSandbox.vue`, loaded via `preview-runtime/preamble.ts:114-122`, `app.ts:282`) is slated for removal. The canvas grid uses one session per frame through `CanvasReplicaPreview.vue`. Frame hooks never attach to the legacy sandbox.
4. **Host channels are embed-only and selected-variant only.** Native standalone does not handle `HOST_CHANNEL_MESSAGE` (present only in `histoire-app/src/app/util/const.ts`). Host-to-frame delivery reaches the selected primary only (`preview-runtime/runtime-service.ts:41-42`). Slice 11 generalizes.
5. **No runtime purpose exists.** `testWorker=true` (`histoire-app/src/embed/adapters/runtime-frame.ts:52`) is never read in the frame; test-worker documents render and fire `markVariantReady`. Controls replicas (`controls=true`), Matrix cells (`matrix=true`) and MCP/screenshot documents (`mcpNonce`, `preview-host.ts:62-65`) use ad-hoc checks. Slice 10 adds one explicit `purpose` parameter.
6. **No reusable frame allocation.** Allocation lives in `CanvasReplicaPreview.vue:108-265`; mounting the component acquires a frame. Budget is computed per view (`CanvasViewport.vue:139-146` vs `MatrixView.vue:69` using `budget - 1`). Slice 08 extracts `acquireStoryFrame` and a ledger.
7. **A client-code path already exists.** `PluginCommand.clientSetupFile` (`histoire-shared/src/types/command.ts:37`) is imported raw by `resolved-commands.ts:31-38`. Slice 02 reimplements it on the client manifest.
8. **Entry resolution precedent.** Support plugins use Node `require.resolve` (`resolved-support-plugins-client.ts:9-18`); only `setupFile` uses Vite `this.resolve` (`virtual/vite-plugin.ts:40-42`). Package entries outside root need `server.fs.allow` like `resolveSupportPluginAllowPaths` (`vite/resolve-paths.ts:38-57`).
9. **Plugin source edits do not restart.** `runtime/config-watchers.ts:89-154` watches config file bytes only. Client modules get ordinary Vite HMR; Node plugin code changes need a manual restart (documented, unchanged).

## Package and loading boundaries

New package `@histoire/plugin-kit`:

- Root: framework-neutral definitions, contribution types, host, lifecycle, context types. No DOM access at import, no framework, no Node/Vite.
- `/frame`: frame plugin definition and frame context.
- `/vue`: workbench-Vue helpers (`defineWorkbenchComponent` typing, `useWorkbenchContext`). Imports `vue`, which slice 04 resolves to vendor Vue for plugin code.
- `/react`, `/svelte4`, `/svelte5`: DOM-mount adapters with optional peers.

Dependency direction: `plugin-kit` depends on `@histoire/protocol` types only. `@histoire/app` and `@histoire/vue` depend on `plugin-kit`. `plugin-kit` never imports app, SDK internals or Vue internals.

## Loading pipeline

1. Node: `ctx.workbenchPlugins` collected next to `ctx.registeredCommands` (`histoire/src/node/context.ts:69-72`) after `configResolved`, in resolved plugin order (`config/merge.ts:41-53`).
2. Vite plugin (`virtual/vite-plugin.ts`) adds `virtual:$histoire-workbench-plugins` and `virtual:$histoire-frame-plugins`, `/__resolved__`-prefixed like commands so the browser URL is stable.
3. Workbench manifest: `[{ id, apiVersion, options, load: () => import(resolvedClient) }]`, lazy, config order. Frame manifest likewise for `frame` entries.
4. App: `@histoire/app` dist keeps `$histoire` imports external (`histoire-app/vite.config.ts:68-71`), so the prebuilt app imports the manifest and the project's Vite compiles plugin modules in dev (`/@fs/` dist served as source) and static build (`build/vite-config.ts:31-34`).
5. Static build: `devOnly` entries omitted before import generation.

## Runtime ownership

- One `ExtensionHost` per workbench, created in `standalone/workbench.ts` next to `createShortcutRegistry` (`:118`) and `createFrameActions` (`:63-77`), provided by inject.
- Host owns plugin setup, registry, preferences, diagnostics and teardown. Surface adapters (inspector, toolbar, shell, canvas, settings, home) read registry views; they are not owned by plugins.
- Nested selected-frame `HistoireProvider` (`WorkbenchApp.vue:151-153`) reuses the root host; selection changes update context, never reinstall plugins.
- Existing per-workbench stores are `createXxx()` factories shared by provide/inject (`standalone/workbench-stores.ts:16`); the host follows that pattern, not Pinia.

## Surface seams

| Surface | Today | Seam |
| --- | --- | --- |
| Inspector tabs | `InspectorTab = '' \| 'docs' \| 'events' \| 'tests'` (`components/inspector/state.ts:4`), `v-if` chain `StoryInspector.vue:108-135`, URL `?tab=` | descriptor registry, `<component :is>` |
| Inspector sections | none; `PropsTab.vue:12` has one `matrix` slot | before/after outlets per tab, footer before Source drawer |
| Toolbar | fixed groups `components/canvas/toolbar/CanvasToolbar.vue:96-132`; overflow `base/overflow/context.ts:24` already open | `v-for` registry items in `BaseOverflowToolbarItem` |
| Commands | static `builtins + registeredCommands` (`standalone/commands.ts:52`), dev-only in search | reactive map with `register()` |
| Shortcuts | `createShortcutRegistry` (`util/shortcuts.ts:85`), scopes closed (`:5`), `reference` leak (`:100`) | expose `register`; fix leak |
| Frame menu | `registerFrameAction` (`util/frame-actions.ts:105`) | pass through |
| Context menu | `createContextMenu().register` (`composables/context-menu.ts:47`), closed targets (`:7-11`) | pass through for existing targets |
| Rail panes | `ShellPane` union (`stores/shell.ts:5`), `isShellPane` (`:35`), `railItems` (`components/shell/rail-items.ts:21`) | registry-backed guard, dynamic slot fallback |
| Settings | `SETTINGS_SECTIONS` (`stores/settings.ts:26`), map in `SettingsPage.vue:11-24`, router guard `standalone/navigation.ts:18-22` | registry, lazy guard lookup |
| Home | fixed grid `components/pages/home/HomePage.vue:80-93` | column-keyed registry |
| Canvas views | `CanvasArrangement` (`stores/canvas.ts:19`) plus inline copies; `if` chain `CanvasViewport.vue:269-276`; `?arrange=` | single type, registry guard, plugin branch |
| Canvas tools | `CanvasTool` (`stores/canvas.ts:17`), `ToolSwitch` slot | registry, dispatch after pan check |
| Overlays | `#overlays` slot `CanvasViewport.vue:278`; each overlay converts its own coordinates | viewport, canvas and per-frame layers |
| Frames | `CanvasReplicaPreview.vue:108-265`; one session per frame (`histoire-sdk/src/session/mounts.ts:69`) | `acquireStoryFrame` lease and ledger |
| `@histoire/vue` | own hard-coded panels (`ExplorerPanels.ts:40-42`), toolbar (`HistoireToolbar.ts`), shortcuts | consume same registry views (slice 13) |

## Frame runtime seams

- Generated runtime: `histoire/src/node/virtual/preview-runtime/index.ts:95-119` concatenates sections; imports live in `preamble.ts:82-160`.
- Real rendered signal: `markVariantReady` (`app.ts:109-126`). Single path wrapper: `components.ts:10-48`.
- Teardown points: selection `syncSelection`/`stopVariantStateWatchers` (`app.ts:46,132`), HMR `STORY_CHANGED_EVENT` (`variant-bridge.ts:31-38`), `pagehide` (`runtime-service.ts:81-88`).
- In-document test mounts (`variant-test-mount.ts`), collection (`browser-collector.ts`) and the hidden metadata mount never pass `markVariantReady`; frame hooks attach there and inherit exclusion.
- Identity: `previewDocumentId` (`host-messaging.ts:4-6`), `selectionVersion`, `HistoireTarget`. No per-mount id; slice 10 mints `actorId`.

## Messaging seams

- Protocol: `histoire-protocol/src/channels.ts` (name regex, 64 KiB, 50 msg/s limiter `:55-80`), bridge identity `bridge/types.ts:22-44`, finite command/event lists.
- Frame side: `host-messaging.ts:38-56`, `message-handler.ts:17-20,36,116-121`.
- Embed wrapper: `histoire-app/src/embed/adapters/channels.ts:6-59`, `runtime-requests.ts:5-50`.
- SDK: `histoire-sdk/src/session/channels.ts:10-110`, `transport/port.ts`, `handshake.ts:26-107`.
- Plugin dev events: `window.__HST_PLUGIN_API__` (`histoire-app/src/app/plugin.ts:13`), `ui-channel.ts` (`histoire:ui:*`, 64 KB) reusable for plugin node/client traffic.

## Overlapping plans

- `plans/devframe-inspection/11-workbench-and-vue-panels.md` adds native panels and inspector tabs; once slice 06 lands those should register through the plugin-kit registry as built-in contributions rather than new hard-coded tabs.
- `plans/embeddable-sdk/12` keeps plugin commands standalone-only and `coordination.md:47` forbids bridging arbitrary plugin events. Slices 07 and 13 keep that rule: remote hosts never evaluate book UI.
