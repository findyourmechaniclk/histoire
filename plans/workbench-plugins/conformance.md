# Conformance (slice 15)

Recorded 2026-10-24 against the uncommitted combined implementation of slices 01–15 on `worktree-workbench-plugins` (HEAD `2387a19bf6dcf8c0a6382decac524670f72448f5`). Command results and environment: [evidence.md](evidence.md). No commit, push, publication or deployment is implied.

## Gate matrix

| Gate | Status | Proven by |
| --- | --- | --- |
| Root `@histoire/plugin-kit` import has no DOM, framework, Node or Vite dependency | pass | `plugin-kit/src/__tests__/imports.spec.ts` (plain Node import via package self-reference; emitted root/frame graphs import only `@histoire/protocol`); bundle audit (no `node:` or Node built-in imports in browser assets) |
| Node-only plugin data never reaches browser assets | pass | `ui-public-config.spec.ts`, `workbench-plugins-serve.spec.ts` (dev HTTP responses and Vite build scanned for sentinels); bundle audit of `examples/react` and `examples/vue3` static builds (Node entry, `fileURLToPath`, `HISTOIRE_REFERENCE_UI`, Node plugin fields absent; only descriptor `options` present) |
| `devOnly` entries absent from static output | pass | `workbench-plugins-serve.spec.ts` (dev-only entry and its transitive import absent from build), `workbench-plugin-shell.spec.ts` (static book omits dev-only pane, recovers a persisted one), `host-registry.spec.ts` (`devOnly` hidden outside dev) |
| Plugin Vue components share workbench Vue in a React story project | pass | `embed/integration/workbench-vue-plugin.spec.ts` (dev and static), `embed/consumers/plugin-reference.spec.ts` (packed Vue UI in a React project, static); bundle audit (single Vue runtime in `examples/react`) |
| DOM, React, Svelte 4, Svelte 5 views mount, update, fail locally, dispose | pass | `adapters.spec.ts`, `host-mount.spec.ts`, `extension-outlet.spec.ts`, reference `variants.spec.ts` (all five UI variants, Svelte 4 included); browser screenshots for DOM, React, Vue, Svelte 5 and Svelte 4 (`svelte4-*.jpg`, `examples/svelte4` dev server) in `evidence/` |
| Two hosts with same definitions stay isolated | pass | `host-registry.spec.ts`, `native-extensions-ownership.spec.ts` |
| Stale generations cannot register, update or publish | pass | `host-setup.spec.ts`, `host-disposal.spec.ts`, `host-mount.spec.ts`, `ui-extensions-scopes.spec.ts` |
| Actions keep captured target across selection change | pass | `ui-extensions-scopes.spec.ts`, `ui-extensions-menus.spec.ts`, `host-disposal.spec.ts` |
| Legacy `?tab=` and `?arrange=` values unchanged | pass | `ui-inspector.spec.ts`, `ui-arrangement.spec.ts`, `ui-canvas-views.spec.ts`, `embed/integration/inspector-plugin-tab.spec.ts` |
| Frame budget enforced across built-in views, Matrix and plugin leases | pass | `canvas-frame-ledger.spec.ts`, `canvas-frame-budget.spec.ts`, `canvas-frame-leases.spec.ts`, `canvas-plugin-views.spec.ts`; Compare view screenshot |
| Frame modules never evaluated in collection, test worker, controls replica, MCP/screenshot documents | pass | `frame-plugins-lifecycle.spec.ts`, `frame-plugins-isolation.spec.ts`, `frame-purpose.spec.ts`, `embed/integration/frame-plugins.spec.ts` (mutation-checked), `native-host-plugins.spec.ts` (data-only) |
| Same variant in two frames never receives the other's plugin messages | pass | `embed/integration/plugin-channels.spec.ts`, `ui-frame-channels.spec.ts` |
| Existing host-channel tests pass unchanged | pass | `test:embed:integration` `host-channels`, `host-channels-frameworks` |
| Packed plugin installs without workspace aliases | pass | `test:embed:consumers` `plugin-reference.spec.ts` |
| Teardown leaves no registrations, listeners, frame sessions or overlays | pass | new `histoire-vue/src/__tests__/canvas-plugin-teardown.spec.ts` (mutation-checked), `host-disposal.spec.ts`, `canvas-plugin-views.spec.ts`, `canvas-frame-leases.spec.ts`, `native-extensions-ownership.spec.ts` |

## Slice 15 checks

1. Dev and static, standalone and embedded, selection changes, HMR, disposal, failure isolation: covered by the specs above; HMR re-attach of frame actors by `frame-plugins-lifecycle.spec.ts`; workbench plugin entry edits use a full reload by design.
2. Workbench Vue, DOM, React, Svelte 4/5 views across Vue, React and Svelte story projects: Vue project with React/Vue/DOM/Svelte 5 UI (browser), React project with Vue UI (browser via consumer spec and integration), Svelte 4 project with the Svelte 4 UI variant (browser, final pass). Svelte 5 adapter cannot run in the Svelte 4 example (project dedupes `svelte`).
3. Keyboard navigation and focus recovery: inspector tab keyboard order and focus restore (`inspector-extensions.spec.ts`), rail focus restore (`workbench-plugin-shell.spec.ts`). Dark theme in all screenshots, light theme for DOM variant. Overflow and narrow layouts: verified in the final pass (below).
4. Bundle audit: [evidence.md](evidence.md#bundle-audit).
5. Teardown stress: `canvas-plugin-teardown.spec.ts` toggles a custom view, Matrix, Grid/List, selection and UI visibility four times with viewport overlay, frame overlay, leasing view, context and frame subscriptions; asserts no duplicate views, every mount disposed, no contribution elements or overlay roots left, plugin signal aborted and setup disposer called once, registry emptied, and every `window` listener added while mounted removed. Removing one `removeEventListener` in `canvas-service.ts` fails it.
6. Source review: see [evidence.md](evidence.md#source-review).

## Resolved after slice 15

Gap fixes and the final pass, proven by tests and browser screenshots (`evidence/`, dev servers of `examples/vue3` with React UI and `examples/svelte4` with Svelte 4 UI, started from this worktree):

- Inspector plugin tab overflow and icons: "More tabs" menu, icons before labels, keyboard over every tab. `inspector-tab-overflow.spec.ts`, `inspector-extensions.spec.ts`; `react-inspector-more-tabs-menu-800px.jpg`. Final pass fixed two browser bugs: (1) tabs used the button group's equal widths, so a kept active plugin tab was clipped (badge hidden, `react-inspector-overflow-tab-clipped-before-fix.jpg`); tabs now size from content. (2) At ≤ 768px the built-ins plus the kept active tab overlapped (`react-768px-tabs-overlapping-before-fix.jpg`); labels now ellipsize and an active plugin tab that cannot fit next to the built-ins shows icon and badge only, label kept in the accessible name (`isActiveTabCompact`, unit-tested; `react-768px-compact-active-plugin-tab*.{jpg,png}`). The template split also lost the space between label and badge in the accessible name (`Acme3`); caught by `inspector-extensions.spec.ts` and fixed.
- State and pane components exported to plugins (`@histoire/plugin-kit/vue`, `ViewHost.renderState`): `workbench-state-components.spec.ts`, plugin-kit `workbench-components.spec.ts`. Native `HistoireExtensionView` now renders its own pending and failed states with the same injected components (new test in `workbench-state-components.spec.ts`).
- Badge, `pressed` and `available` refresh on plugin state: `api.invalidate()`. `inspector-extensions.spec.ts`, `plugin-toolbar.spec.ts`, reference `variants.spec.ts`; browser: tab badge appears when the frame report arrives (`react-badge-before-report.jpg`, `react-badge-after-report-invalidate.jpg`).
- Canvas refit: `CanvasViewService.requestLayout()`. `canvas-plugin-views.spec.ts`.
- Custom view pointer routing: `canvas-plugin-view-input.spec.ts`; browser on the Compare view: Select-tool drag on a column reaches the column (one `pointerdown`) and leaves the camera unchanged; Pan-tool drag on the same column pans and the column sees no `pointerdown` (`react-compare-view-pan-tool-vs-select.jpg`).
- Native toolbar groups, native `canvas`/`frame` shortcut scopes, registration-time conflicts and `comment` rejection: `native-extensions-placement.spec.ts`. `comment` stays a diagnostic, not a `WorkbenchCapability` (see public-api.md, final pass).
- Workbench Vue plugins in the source-origin explorer: `native-host-plugins.spec.ts` (dev and static).
- Cross-tab preferences (`StorageLike.subscribe`): plugin-kit `preferences.spec.ts`, `host-registry.spec.ts`, `ui-extensions-services.spec.ts`.
- Dev restart on local plugin source edits: `config-dependencies.spec.ts`; ad-hoc loader check of ESM `.js` in a `type: module` package, CommonJS `.js`, TypeScript with `import.meta.url` and a local import, top-level await, `node:` built-in plus local `.mjs` import, `.histoire.ts`: all load (see evidence).
- Immediate frame retirement for `api.frames.subscribe`: `ui-frame-channels.spec.ts`.
- `examples/vue3` Markdown discovery under dot-folder paths: `markdown/discovery.spec.ts`.
- Svelte 4 adapter in a browser: new reference `svelte4` UI variant (Svelte 4 compiler, shared domain model), wired into `examples/svelte4`; `variants.spec.ts`; `svelte4-inspector-section.jpg`, `svelte4-rail-pane-and-tab.jpg`, no console errors.
- Narrow layouts (768px and 375px): rail pane (`react-768px-rail-pane.jpg`, `react-375px-rail-pane-drawer.jpg`), settings section content aligned with built-in rows (both at x = 29px at 375px; `react-375px-settings-*.jpg`), toolbar overflow with plugin tool, view, action, toggle and popover items (`react-768px-toolbar-overflow-plugin-items-hints.jpg`).
- Shortcut hints on plugin toolbar `action`, `toggle` and now `popover` items (`command`): `plugin-toolbar.spec.ts`; overflow menu shows `Alt ⇧ B` on "Issue badges".

## Unresolved limitations

- Node modules loaded natively by the config loader (`.mjs`, `.cjs`, `.js` in `type: module` packages) and installed plugin packages do not trigger a dev restart; restart by hand.
- `custom` toolbar items have no shortcut hint (they render their own control), and native `@histoire/vue` toolbars show no hints at all. A popover's `command` hint names a command; plugins cannot open a toolbar popover from a shortcut.
- At very narrow inspector widths the four built-in tab labels themselves ellipsize (they did not fit before plugins either).
- The reference plugin's own list views keep their plain empty text instead of `WorkbenchEmptyState` (author choice in the example, not a host limit).
- `vue-tsc` is not installed in this worktree, so the final pass did not rerun the workbench `vue-tsc` check; `tsc -p packages/histoire-app/tsconfig.embed.json` and every package build pass.
- Remote CI not run.
