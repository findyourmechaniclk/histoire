# Public API

Authoritative contract for all slices. Slices may refine internals, never these shapes, without updating this document first. Names are proposals until slice 01 lands.

## Node descriptor

```ts
/** Browser-facing part of a Histoire plugin. */
interface WorkbenchPluginDescriptor {
  /** Stable identity shared by Node, workbench and frame modules. `[a-z][a-z0-9-]*`, not `builtin`. */
  id: string
  /** Extension contract version; only `1` exists. */
  apiVersion: 1
  /** Module default-exporting `defineWorkbenchPlugin(...)`. */
  client?: string
  /** Module default-exporting `defineFramePlugin(...)`. */
  frame?: string
  /** Explicit browser-visible JSON options. Nothing else from the Node plugin reaches the browser. */
  options?: HistoireJsonValue
  /** Exclude both entries from static builds. */
  devOnly?: boolean
}

interface Plugin {
  // existing fields unchanged
  workbench?: WorkbenchPluginDescriptor
}
```

Entry resolution: a bare specifier or absolute path resolves through Vite from the project root. A relative path written by a package author is resolved by that package with `import.meta.resolve` or `fileURLToPath(new URL(...))` before being returned; Histoire treats remaining relative paths as project-root relative.

## Workbench plugin definition

```ts
/** Default export of a `client` entry. */
function defineWorkbenchPlugin(definition: {
  id: string
  apiVersion: 1
  /** Runs once per extension host. Registrations made before it settles commit atomically. */
  setup: (api: WorkbenchPluginApi) => Awaitable<void | Disposer>
}): WorkbenchPluginDefinition

type Disposer = () => void

interface WorkbenchPluginApi {
  readonly id: string
  readonly options: HistoireJsonValue | undefined
  /** Root-scoped context; surfaces receive narrower scopes. */
  readonly context: WorkbenchContext
  readonly preferences: PluginPreferences
  readonly signal: AbortSignal
  /** Generic registration; helpers below are typed sugar over it. */
  contribute: (contribution: WorkbenchContribution) => Disposer
  inspector: { addTab, addSection }
  toolbar: { addItem }
  commands: { add }
  shortcuts: { add }
  menus: { addFrameAction, addContextAction }
  canvas: { addOverlay, addFrameOverlay, addTool, addView }
  shell: { addPane }
  settings: { addSection }
  home: { addSection }
  frames: { list, open }
  reportError: (error: unknown) => void
}
```

Every helper returns a `Disposer`. Registrations after setup follow the same ownership and are disposed with the plugin.

## Views

Both renderers are first class; every view-bearing contribution accepts either.

```ts
type ContributionView<C> =
  /** Vue component compiled against the workbench Vue; receives `context` prop. */
  | { component: Component }
  /** Framework-neutral mount. */
  | { mount: ViewMount<C> }

type ViewMount<C> = (
  container: HTMLElement,
  context: C,
  host: ViewHost,
) => Awaitable<ViewHandle | void>

interface ViewHost {
  /** Aborted when the view's scope retires; late completions are disposed immediately. */
  signal: AbortSignal
  /** Element for popovers/menus inheriting workbench theme variables. */
  overlayRoot: HTMLElement
  reportError: (error: unknown) => void
}

interface ViewHandle {
  /** Called with each new context snapshot instead of remounting. */
  update?: (context: C) => void
  dispose?: () => Awaitable<void>
}
```

Adapters: `reactView(Component)` from `/react`, `svelte4View(Component)` from `/svelte4`, `svelte5View(Component)` from `/svelte5`; each returns `{ mount }`. Vue components outside the workbench Vue (rare: native React host rendering a Vue plugin) use `vueView(Component)` from `/vue/mount`, which creates an isolated app.

## Contributions

All carry local `id`, optional `order: number`, optional `available: (context) => boolean`, optional `devOnly`. Host qualifies ids as `${pluginId}:${id}`; `builtin:` is reserved. Duplicates reject before any partial registration is exposed.

| kind | required fields | placement |
| --- | --- | --- |
| `inspector.tab` | `label`, `icon`, view, optional `badge(context)` | after built-in tabs |
| `inspector.section` | `tab` (`builtin:props\|docs\|events\|tests` or qualified plugin tab, or `footer`), `position: 'before'\|'after'`, view | around tab body; footer before Source drawer |
| `toolbar.item` | `group` (existing group name or `plugins`), `type: 'action'\|'toggle'\|'popover'\|'custom'`, `label`, `icon`, `run`/`pressed`/view | inside named overflow group |
| `command` | `label`, `icon`, `run`, optional `searchText` | command search |
| `shortcut` | `command` (qualified id), `keys`, `scope` | existing shortcut registry |
| `frame-menu.item` | `label`, `icon`, `run`, optional `group`, `children` | frame context menu |
| `context-menu.item` | `targets` (existing `WorkbenchContextTarget` kinds), `label`, `run` | existing context menu |
| `canvas.overlay` | `space: 'viewport'\|'canvas'`, view, `interactive?` | viewport or canvas layer |
| `canvas.frame-overlay` | view (per frame, frame-scoped context), `interactive?` | per-frame layer |
| `canvas.tool` | `label`, `icon`, `cursor?`, pointer handlers, optional `shortcut` | tool switch |
| `canvas.view` | `label`, `icon`, view (canvas-scoped context) | arrangement switch |
| `shell.pane` | `label`, `icon`, view, optional `badge` | rail after built-ins |
| `settings.section` | `label`, `icon`, view | settings nav after built-ins |
| `home.section` | `column: 'primary'\|'secondary'`, `title`, view | appended to column |

Ordering: built-ins keep relative order; plugin entries sort by `order`, then config order, then registration order.

## Actions

```ts
type ActionRun<C> = (context: C, options: { signal: AbortSignal }) => Awaitable<void>
```

The host captures the target scope when invocation starts. Selection or source change aborts the signal; results after abort are discarded. Pending state and errors surface through the invoking surface.

## Context

```ts
interface WorkbenchContext {
  readonly capabilities: ReadonlySet<WorkbenchCapability>
  readonly source: { mode: 'dev' | 'static' | 'remote' }
  readonly catalog: CatalogService // SDK-backed, readonly
  readonly selection: Readonly<{ target: HistoireTarget | null }>
  readonly navigation: NavigationService // tabs, panes, settings, views, stories
  readonly devEvents?: DevEventService // present only with compatible dev transport
  subscribe: (listener: () => void) => Disposer
}

interface FrameScopedContext extends WorkbenchContext {
  readonly frame: FrameRef
  /** Readonly runtime state/settings of exactly this frame. */
  readonly runtime: FrameRuntimeView
}

interface CanvasScopedContext extends WorkbenchContext {
  readonly canvas: CanvasService // geometry, coordinate transforms, frame leases
}

interface FrameRef { readonly key: string, readonly target: HistoireTarget }
```

Unsupported services are absent and listed as unavailable in `capabilities` before invocation; they never throw on access.

## Preferences

```ts
interface PluginPreferences {
  get: <T extends HistoireJsonValue>(key: string, fallback: T) => T
  set: (key: string, value: HistoireJsonValue) => void
  subscribe: (key: string, listener: (value: HistoireJsonValue) => void) => Disposer
}
```

Standalone persists under a plugin and project namespace. Embedded hosts persist only when they inject storage.

## Frame plugin definition

```ts
/** Default export of a `frame` entry; evaluated only in interactive frames. */
function defineFramePlugin(definition: {
  id: string
  apiVersion: 1
  /** Called once per rendered actor after variant readiness. */
  attach: (frame: FramePluginContext) => Awaitable<void | Disposer>
}): FramePluginDefinition

interface FramePluginContext {
  readonly actorId: string
  readonly documentId: string
  readonly target: HistoireTarget
  /** Rendered variant root element. */
  readonly element: HTMLElement
  readonly signal: AbortSignal
  readonly state: ReadonlyFrameState
  readonly options: HistoireJsonValue | undefined
  readonly channel: PluginChannel
  onCleanup: (callback: () => void) => void
}
```

## Plugin channels

```ts
interface PluginChannel {
  post: (type: string, data: HistoireJsonValue) => Promise<void>
  on: (type: string, listener: (data: HistoireJsonValue, message: PluginChannelMessage) => void) => Disposer
  getDroppedCount: () => number
}

interface PluginChannelMessage {
  pluginId: string
  actorId: string
  target: HistoireTarget
  type: string
  data: HistoireJsonValue
}
```

Workbench side: `api.frames.list()` returns frames with the plugin attached; `api.frames.open(frameRef)` returns a `PluginChannel` bound to that exact actor. SDK: `session.plugins.frames()` and `session.plugins.open(pluginId, frameRef)`.

## Host API (embedding)

```ts
function createExtensionHost(options: {
  plugins: Array<WorkbenchPluginDefinition | { definition: WorkbenchPluginDefinition, options?: HistoireJsonValue }>
  services: ExtensionHostServices // session, navigation, storage, capabilities
}): ExtensionHost

interface ExtensionHost {
  /** Resolves when all plugin setups settled (success or attributed failure). */
  ready: Promise<void>
  contributions: <K extends ContributionKind>(kind: K) => ReadonlyArray<QualifiedContribution<K>>
  subscribe: (listener: () => void) => Disposer
  mount: (contributionId: string, container: HTMLElement, context: unknown) => MountedView
  run: (contributionId: string, context: unknown) => Promise<void>
  diagnostics: () => ReadonlyArray<PluginDiagnostic>
  dispose: () => Promise<void>
}
```

Vue: `HistoireProvider` gains optional `extensions: ExtensionHost` prop; `HistoireExtensionOutlet` renders one surface's contributions. Caller-created hosts stay caller-owned.

## Compatibility

- `Plugin` without `workbench` unchanged.
- `PluginCommand.clientSetupFile` keeps working.
- `window.__HST_PLUGIN_API__` and `histoire/plugin.js` keep working.
- Inspector `?tab=` values `''`, `docs`, `events`, `tests` and `?arrange=` values unchanged; plugin values use qualified ids.
- Unknown or unavailable plugin values fall back to existing defaults only after `ready` settles.

## Refinements from slice 01

Implemented types in `packages/histoire-plugin-kit/src/types/` are authoritative where they differ from sketches above:

- `ContributionKindMap` is the single source of contribution kinds; helpers take `XxxInput` types; `QualifiedContribution` adds `pluginId` and `localId`.
- Inspector tabs and sections receive `FrameScopedContext`. Context-menu items receive `ContextMenuContext` with captured `target`.
- Inspector section `tab` must be qualified (`builtin:props`, not `props`).
- `ExtensionHostServices` is `{ context, storage?, storageNamespace? }`; navigation and capabilities live on the root context. plugin-kit never depends on SDK session types.
- `CanvasService`, `NavigationService` and `FrameLease` are drafts refined by slices 05 and 08.

## Refinements from slice 03

`ExtensionHost` (see `packages/histoire-plugin-kit/src/types/host.ts`) adds:

- `available(kind, context)`: filtered view; `devOnly` only for dev sources; a throwing predicate hides its contribution permanently.
- `registerBuiltin(contribution)`: app-only path for `builtin:` entries.
- `run(id, context, { signal? })`: caller passes its captured scope signal; aborted-first results drop silently, other errors are recorded and rethrown.
- `subscribe` also fires on root context change and new diagnostics.
- `createScope()` exported for generation tokens.

## Refinements from slice 04

- `ExtensionHost.mount(id, container, context, options?: ViewMountOptions)` with `overlayRoot` and `onError`.
- `ExtensionHost.reportViewError(id, error)` records failures from workbench Vue component views.
- `/vue`: `useWorkbenchContext()` (live proxy over current context), `useViewHost()`; shared `WORKBENCH_VIEW_KEY` via `Symbol.for`.
- Adapter components (`reactView`, `svelte4View`, `svelte5View`, `vueView`) receive props `{ context, host }`.
- Svelte peer range `^4.0.0 || ^5.7.0`.
- Workbench Vue resolution: modules reached from the workbench manifest are marked with a `histoire-workbench` query; `vue`, `@vue/runtime-dom|runtime-core|reactivity` and `@histoire/controls/vue` resolve to workbench copies; other `vue/*` subpaths error (vendor build is runtime-only).

## Refinements from slice 12

- Presence semantics for plugin navigation targets (panes, settings sections): `pending` until `host.ready` (or until a workbench binds the registry), then `present` or `missing`. Pending shows `WorkbenchLoadingState`; missing falls back (Stories, Appearance).
- Router binds settings lookup through `navigation.bindSettingsSections(lookup)` (internal app API).
- Contribution icons outside the bundled glyph list render `plug` with a one-time warning (`resolveContributionIcon`).

## Refinements from slice 06

- Built-in inspector tabs are app-local descriptors (`INSPECTOR_BUILTIN_TABS`, `INSPECTOR_BUILTIN_VIEWS` in `histoire-app/src/app/components/inspector/builtins.ts`), not `registerBuiltin` entries; plugin sections still target them by `builtin:<tab>` ids.
- Open: tab overflow for many plugin tabs; plugin tab icons not rendered yet. *(Superseded: both resolved, see "Refinements from gap fixes: inspector tabs, badges, toolbar hints".)*

## Refinements from slice 07

- Frame-menu children are addressed as `${itemId}:${childId}` (e.g. `acme:export:json`); `host.run` resolves them under the parent plugin's scope.
- Plugin commands appear in command search in static books when available; built-in and Node-backed commands stay dev-only.
- Shortcut conflicts (with any built-in binding, active or not, or an existing binding) skip the binding and record a `report` diagnostic; the command stays searchable.

## Refinements from slice 11

- Protocol (`@histoire/protocol`, `plugin-channels.ts`): `HistoirePluginChannel` (structurally equal to plugin-kit `PluginChannel`), `HistoirePluginChannelPayload { pluginId, actorId, type, data }`, `HistoirePluginChannelMessage` (+ `target`), `HistoireFramePluginInfo { id, apiVersion }`. Types prefixed `histoire:` are runtime notices (`histoire:attached`, `histoire:detached`, `histoire:error`); plugins can neither post nor observe them.
- Bridge: command `plugin.post`, event `plugin.message` (payload adds `target`, `runtimeId`); same authority and 64 KiB limit as `channel.*`.
- Descriptor: optional top-level `framePlugins: [{ id, apiVersion }]` and optional capability `capabilities.framePlugins`; both omitted for books without frame plugins.
- SDK: `session.plugins` is optional on `HistoireSession` (absent on view proxies). `plugins.frames()` (descriptor inventory, data-only), `plugins.actors(pluginId)` (attached actors `{ pluginId, actorId, target, runtimeId }`), `plugins.subscribe(listener)`, `plugins.open(pluginId, { actorId })`. Failures: `NOT_CONNECTED`, `CAPABILITY_UNAVAILABLE` (not installed), `PROTOCOL_MISMATCH` (apiVersion ≠ 1), `RUNTIME_CHANGED` (actor retired), `PREVIEW_NOT_READY` (frame without actor, standalone).
- Workbench: `api.frames.open(frame)` binds to `frame.actorId` when given (a `PluginFrameRef` from `list()`), else to the frame's current actor. Channels are released with the plugin. Frame failures become `report` diagnostics of the plugin with the same id. Hosts expose frame messaging through a `PluginFrameService` on the root context under `Symbol.for('@histoire/plugin-kit/frames')` and list capability `frames`.

## Refinements from slice 08

- `CanvasService.acquireFrame(target, options: FrameLeaseOptions)`: `container` required; optional `rect`, `queue`, `signal`. Rejects with `FrameLeaseError` (`reason: 'budget' | 'released' | 'unavailable'`).
- `CanvasService` adds `pan` and `frameToViewport`.
- Plugin overlay layers render inside `CanvasViewport` (not the `#overlays` slot), hidden with UI and during comment placement.
- `FrameRef.key` is the canvas frame id everywhere (inspector contexts included).

## Refinements from slice 09

- `CanvasViewInput` adds optional `layout(zoom) => CanvasFrameLayout[]` (used for fit) and `toolbar` (toolbar groups the view supports; view switch and inspector toggle always shown).
- Custom views may lease up to the full frame budget; the selected leased frame publishes its session to the inspector.
- Plugin views with no saved zoom open at Fit. A view's `available` predicate runs against the root context.
- Open: plugins cannot request a refit; pressing on view content pans unless the view stops the event. *(Superseded: `requestLayout()` and view pointer routing, see "Refinements from gap fixes: canvas".)*

## Refinements from slice 13

- plugin-kit root adds host helpers shared by standalone, native Vue, React and DOM hosts: `createSessionContext({ session, mode?, navigation?, devEvents?, frames? })` (structural SDK session; `mode` defaults to `remote`; default navigation selects stories and ignores other destinations with a warning), `createSessionNavigation`, `createSessionFrameService(session.plugins, { frameKey? })` (frame keys default to `getHistoireTargetKey`), `lazyWorkbenchPlugins(manifestEntries)`, `PLUGIN_FRAMES_SERVICE`/`PluginFrameService`, `BUILTIN_INSPECTOR_TABS`, `BUILTIN_SHORTCUTS`, `findBuiltinShortcutConflict`, `matchesShortcut`, `shortcutBindingsOverlap`, `isEditableTarget`.
- `@histoire/vue`: `HistoireProvider.extensions` (caller-owned, never disposed, kept across session replacement; nested providers without it reuse the nearest host; only the owning provider binds plugin shortcuts) and `HistoireExtensionOutlet` (`kind`, optional `context`, `filter`). Internal: `provideHistoireExtensions(host)`, `HistoireExtensionView`.
- Native explorer panels keep `activePanel` keys (`controls`, `docs`, `events`, `tests`, plugin ids) and the "Controls" label for `builtin:props`; plugin tabs and sections follow the shared built-in descriptors. Native toolbars ignore `group` (registry order after built-ins). Only `global` shortcuts fire in native hosts. *(Superseded: native toolbars place items by group and native hosts support `global`, `canvas` and `frame` scopes, see "Refinements from gap fixes: native hosts".)*

## Refinements from slice 14

- Preference writes notify host subscribers, so every surface reading a preference refreshes.
- Standalone workbench logs each plugin diagnostic once: `[histoire plugin "<id>"] <phase> failed:`.
- CommonJS dependencies imported from workbench plugin graphs (e.g. `react`) are registered with Vite's dependency optimizer; installed React-UI plugins work in dev.

## Refinements from slice 15

- `api.frames.subscribe(listener) => Disposer`: fires when this plugin's `list()` changes (actor attach or detach); plugin-owned, released with the plugin, inert in hosts without frame messaging. `PluginFrameService` gains a required host-wide `subscribe(listener)`; plugin-kit narrows it per plugin by diffing `list()`. Standalone notifications come from attach/detach notices and from retirements found by sweeps; native hosts forward `session.plugins.subscribe`.
- Plugin ids are at most 64 characters everywhere (Node descriptor, `defineWorkbenchPlugin`/`defineFramePlugin`, channel messages); the single grammar is `isHistoirePluginId` from `@histoire/protocol`.
- plugin-kit root exports `createContributionKeys()` (render keys following contribution objects) for hosts listing contributions.
- `@histoire/vue/internal` exports `useExtensionView` (view binding, local failures, DOM mount, updates, overlay root); the standalone `ExtensionView.vue` and native `HistoireExtensionView` share it and differ only in rendered states.
- The standalone root context carries the `frames` capability and frame service itself (`createSessionContext({ frames })`), so surface contexts and plugin contexts list the same capabilities.

## Refinements from gap fixes: canvas

- Custom views receive `CanvasViewContext` (a `CanvasScopedContext` whose `canvas` is a `CanvasViewService`, both in `types/canvas.ts`). `CanvasViewService.requestLayout()` tells the canvas the view's `layout` changed: the canvas re-reads it once after the current update (calls coalesce), without remounting, and applies the zoom policy (Fit frames the new boxes, a fixed zoom keeps the camera). No-op after the view is switched away. Scoped to views rather than `CanvasService` because only views own a `layout`; named `requestLayout` rather than `refit` because a fixed zoom does not refit.
- View pointer input follows story frames. The content root (host-marked `data-histoire-canvas-view`) owns primary presses with the Select tool: the canvas neither pans nor focuses itself. Pan tool, held Space and middle button pan from a capture-phase viewport handler that stops the press before the content sees it (clicks still fire). A press whose target element itself carries `data-histoire-canvas-pan` (descendants excluded) behaves like empty canvas. Built-in arrangements unchanged.

## Refinements from gap fixes: inspector tabs, badges, toolbar hints

- `api.invalidate(): void` on `WorkbenchPluginApi`: tells the host that plugin-internal state read by `badge`, `pressed` or `available` callbacks changed. It notifies host subscribers synchronously (like a preference write), so inspector tab badges, rail badges, toolbar `pressed` and availability are re-read. No-op after the plugin retired. One plugin-wide call rather than a `refresh` per contribution: surfaces already re-read every callback on host notifications, and plugin state usually feeds several contributions.
- Toolbar `action` and `toggle` items accept optional `command` (qualified command id). The shortcut bound to that command (first registered `shortcut` contribution targeting it; conflicting bindings are never registered) is shown as the button hint, formatted by the shortcut registry like built-in hints (tooltip, overflow menu). `run` is unchanged. Popover and custom items have no hint. *(Superseded for popovers, see "Refinements from final pass".)*
- Inspector plugin tabs render their `icon` (through `resolveContributionIcon`) before the label; built-in tabs keep labels only. Plugin tabs that do not fit the tab row move to a "More tabs" menu (`BasePopover` + `MenuItem`, fit computed with the overflow toolbar's `fitOverflowItems` and clone measurement). Built-in tabs and the active tab always stay in the row. Arrow/Home/End on the tab list walk every tab, overflowed ones included (selecting one moves it into the row); the trigger opens with ArrowDown/ArrowUp and the menu supports Arrow/Home/End, Escape and Tab.

## Refinements from gap fixes: state components

- `@histoire/plugin-kit/vue` exports `WorkbenchEmptyState` (`icon`, `title`; slots `default`, `actions`), `WorkbenchLoadingState` (`title`; `default`), `WorkbenchErrorState` (`title`, optional `icon`; `default`, `actions`), `WorkbenchPaneHeader` (`title`; `default`), `WorkbenchPaneToolbar`, `WorkbenchPaneList` (`default`). Each renders the implementation injected under `WORKBENCH_COMPONENTS_KEY`, else plain unstyled markup (`status`/`alert` region, `h2` header). plugin-kit never imports a host.
- Root: `WORKBENCH_COMPONENTS_KEY` (`Symbol.for('histoire.plugin-kit.workbench-components')`), `WorkbenchComponents` (partial map keyed by the export names), `WorkbenchState` (`{ kind: 'empty', icon, title, detail? } | { kind: 'loading', title, detail? } | { kind: 'error', title, icon?, detail? }`), `renderPlainWorkbenchState(element, state | null)`.
- `ViewHost.renderState(element, state | null)` (required member): renders a state into a view-owned element, re-renders in place, `null` clears. `ViewMountOptions.renderState` supplies the host renderer; default `renderPlainWorkbenchState`. Actions are Vue-only. Kept on `ViewHost` (not a separate helper) because only the host knows its styled components; it reuses the same component map, so the neutral path adds no second implementation.
- Standalone: `ExtensionView.vue` provides the shell components (`components/extensions/workbench-components.ts`) to every plugin view and passes them to `useExtensionView({ components })` for DOM states. Provided per view instead of in `extensions/standalone.ts`: every standalone plugin surface renders through `ExtensionView`, and `tsc -p tsconfig.workbench.json` cannot type `.vue` imports from `.ts` files it reaches.
- `@histoire/vue`: `HistoireProvider` provides native equivalents (`components/extensions/workbench-components.ts`, `styles/extensions.css`) only when no enclosing app provided any, so nested providers keep the outer look. `useExtensionView` renders DOM states as separate Vue roots in the view's app context and unmounts them with the view.
- Settings: plugin sections render inside a `histoire-settings-card` under the title; in it `--histoire-pane-gutter` equals the settings row inset (20px, 14px narrow), so gutter-padded views line up with built-in rows. Plugin pane bodies are flex columns.

## Refinements from gap fixes: preferences, restart, frames

- `StorageLike` gains optional `subscribe(listener: (key: string | null) => void) => Disposer`, reporting changes made outside the host (another tab; `null` = storage cleared). When present, the host subscribes once and releases it on `dispose`. For keys under its own `<namespace>:plugin:` prefix it drops its memory overlay entry, delivers the parsed value to `api.preferences.subscribe` listeners of that key and notifies host subscribers (badges, toggles re-read). Removed or unparseable values notify host subscribers only: key listeners cannot know the fallback a `get` would use. Storage without `subscribe` behaves as before, so embedded hosts opt in through the storage they inject.
- Standalone `createWorkbenchStorage(window)` wraps `localStorage` and implements `subscribe` with `storage` events of that storage area (session storage events ignored). Preference listener errors are attributed to the plugin whichever writer caused them.
- Dev restarts also cover local modules (outside `node_modules`) imported by the config files: the Histoire config's from jiti's module cache of that load (`evalModule` with an owned cache, so filesystem cache hits are included), the Vite config's from Vite's `configFileDependencies`. Their bytes are read right after loading and compared when the watcher is ready, so an edit during acquisition still restarts. The restart source is the importing config (`Histoire` or `Vite`). Exposed internally through `getConfigDependencies(ctx.config)` (`histoire/src/node/config/dependencies.ts`). Limit: modules jiti hands to Node natively (`.mjs`, `.cjs`, `.js` in `type: module` packages) are neither listed nor, for ESM, re-evaluated by an in-process restart; local Node plugin code written in TypeScript gets automatic restarts. Workbench `client` and `frame` entries keep Vite HMR.
- Standalone `api.frames.subscribe` fires as soon as the canvas frame registry drops a frame (unregistration on lease release, view switch, unmount) or replaces its document. `registerFrames` observes the registry with a synchronous Vue watcher over frame keys and document ids (the registry is `shallowReactive`; no polling) and retires affected actors with `RUNTIME_CHANGED`. Non-reactive registries keep sweep-on-access.
- Markdown discovery matches `**/*.story.md` relative to the project root. Chokidar passes absolute paths to `ignored`, and `**` skips dot segments, so a project whose absolute path contains a dot directory (`.claude/worktrees/...`, `~/.cache/...`) discovered no Markdown story at all. That caused the `examples/vue3` `[md] Cannot find story file: ../MarkdownFile.story.md` failure; the example link is correct. Hidden directories inside the project stay excluded.

## Refinements from gap fixes: native hosts

- Native toolbar groups (`@histoire/vue` `HistoireToolbar`): plugin items render after the built-ins of the group they name, using the standalone group names. `viewport` follows Viewport width, height, Rotate and Viewport preset; `background` follows Background and Checkerboard; `ui` follows Appearance (same place when the color scheme switch is hidden); `plugins` trails after Open in editor. Groups without a native counterpart (`search`, `tools`, `arrange`, `zoom`, `screenshot`, `embed`, `inspector`) and unknown names fall back to `plugins`. Registry order within a group. Internal: `NATIVE_TOOLBAR_GROUPS`, `nativeToolbarGroup` (`histoire-vue/src/components/toolbar/groups.ts`); `ToolbarExtensions` takes a required `group` prop.
- Native shortcut scopes: `global` (provider root), `canvas` (`ExplorerPreview`, the explorer canvas) and `frame` (its single-variant frame; none in Grid layout), tried innermost first like the standalone workbench. Focus areas carry `data-histoire-shortcut-scope="canvas|frame"` and count only inside the owning provider. Keys pressed inside a story document never reach the host (same as standalone). `comment` has no native surface: its shortcuts are disabled with a `report` diagnostic at registration. Reported as a diagnostic, not a capability: `WorkbenchCapability` is a closed type listing services, not focus scopes.
- Registration-time shortcut checks shared by every host: plugin-kit `findPluginShortcutConflict(shortcut, { bound?, scopes? })` returns the diagnostic error (scope the host lacks; overlap with a built-in, bound or not; overlap with an earlier bound shortcut of the same scope) or `undefined`. The standalone workbench passes its shortcut registry entries; the app registry's `builtinConflict` is removed.
- plugin-kit `createPluginShortcutBindings(host, scopes = ['global'])` for hosts without a shortcut registry (native Vue, React, DOM): checks each committed `shortcut` contribution once, reports each rejection once per host (several providers observing one host do not duplicate it), frees keys when a contribution leaves; `match(event, scopes, accept?)` returns the first bound shortcut in scope order; `dispose()` stops observing. Commands of rejected shortcuts stay registered and runnable. `@histoire/vue` binds it on the owning provider with `NATIVE_SHORTCUT_SCOPES`.
- `renderVitestRunnerBootstrap` (histoire `virtual/vitest-runner-bootstrap.ts`) also stubs `__vitest_mocker__.wrapDynamicImport`: dev transforms wrap the workbench manifest's dynamic imports with it, so the dev source-origin explorer loaded no book plugin. Workbench Vue component plugins in the source-origin explorer are proven in dev and static (`native-host-plugins.spec.ts`: a Vue inspector tab renders and injects the view binding of the explorer's Vue app).

## Refinements from final pass

- Toolbar `popover` items accept `command` too (`ToolbarButtonCommon`); the bound shortcut is the trigger hint. Clicking opens the popover; the shortcut runs the command (plugins cannot open a toolbar popover programmatically). `custom` items render their own control, so they take no `command`.
- Native `HistoireExtensionView` renders pending and failed views with the injected `WorkbenchLoadingState`/`WorkbenchErrorState` (enclosing workbench's, else native), titled like the standalone `ExtensionView` (`Loading <name>`/`<name> failed`, `Loading extension`/`Extension failed` without a label).
- `comment` scope unavailability stays a registration diagnostic, not a `WorkbenchCapability` value: capabilities list context services a plugin reads, while shortcut scopes are host focus areas checked when a binding registers; a capability would need a parallel scope list per host and still not cover `canvas`/`frame` differences inside one host.
