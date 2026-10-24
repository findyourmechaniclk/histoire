# 13 — Standalone and embedding integration

## Outcome and prerequisites

Depends on: 06–12. Standalone, native Vue (`@histoire/vue`), generic DOM hosts and the source-origin iframe explorer have documented, tested plugin behavior.

## Owned files

- `histoire-vue/src/provider/HistoireProvider.ts` (`:14-17`): optional `extensions: ExtensionHost` prop; context gains host (`provider/context.ts:65-80`). Generation remount (`:85-92`) keeps caller-owned host.
- `histoire-vue/src/components/extensions/HistoireExtensionOutlet.ts` (new).
- Unify duplicated surfaces with registry views:
  - `histoire-vue/src/components/explorer/ExplorerPanels.ts:40-42` panel list.
  - `histoire-vue` `HistoireToolbar.ts` hard-coded `h()` list.
  - `histoire-vue/src/provider/shortcuts.ts`.
  Built-in panels become `builtin:` descriptors consumed by both app and vue.
- `histoire-app/src/app/standalone/mount.ts`: host created and disposed with workbench; nested selected-frame provider (`WorkbenchApp.vue:151-153`) reuses root host.
- `histoire-plugin-kit` host docs for non-Vue hosts: `contributions`, `mount`, `run`.

## Tests first

1. Two workbenches on one page with different sources and plugins stay isolated.
2. Provider session replacement cleans scoped mounts without disposing caller's host.
3. Host-owned URL, title, theme and storage unchanged by default; preferences memory-only without injected storage.
4. React host and plain DOM host mount contributed inspector tab via host API.
5. Cross-origin book frame plugin communicates with host-imported workbench plugin through SDK.
6. Native remote host never evaluates book-provided UI modules; descriptor lists frame plugins only as data.
7. Caller slot replacing a native surface wins over plugin contributions for that surface.

## Implementation steps

1. Provider prop and outlet.
2. Migrate `ExplorerPanels`, `HistoireToolbar`, shortcuts to descriptor views shared with the app; keep public slots (`HistoireExplorer.ts:30-36`).
3. Source-origin iframe explorer: book document loads its own manifest (same as standalone).
4. Unsupported surfaces for a host report unavailable; contributions for them stay registered but unrendered.

## API changes

`HistoireProvider.extensions`, `HistoireExtensionOutlet`, documented host API.

## Failure paths

Host without required service for a contribution: contribution unavailable, diagnostic, no throw.

## Validation commands

~~~bash
pnpm --filter @histoire/vue test
pnpm --filter @histoire/sdk test
pnpm --filter histoire test:embed:integration
pnpm --filter histoire test:embed:consumers
~~~

## Acceptance criteria

Standalone, native Vue, generic DOM host and source-origin iframe explorer behave as documented with one shared registry implementation.

## Non-goals

Automatic remote UI loading.

## Status

Landed 2026-10-24 (uncommitted).

- plugin-kit (shared by every host, root entry still imports only `@histoire/protocol`):
  - `session/context.ts`: `createSessionContext` (moved from app `extensions/context.ts`, now structural over the SDK session; optional `frames`, default `remote` mode and `createSessionNavigation`).
  - `session/frames.ts`: `createSessionFrameService(session.plugins)`, the native frame service (slice 11 open issue 4). Placed in plugin-kit, not histoire-vue: React and plain DOM hosts need it without depending on Vue; typed structurally so plugin-kit still never imports the SDK. Plain frame refs bind to the latest actor of the target key; channel listeners released with the plugin; `onError` is a no-op (remote frame failures are not observable).
  - `host/manifest.ts`: `lazyWorkbenchPlugins` (moved from app `extensions/plugins.ts`) so the embed explorer (tsc `rootDir: src/embed`) shares it.
  - `builtins.ts` `BUILTIN_INSPECTOR_TABS`, `shortcuts.ts` `BUILTIN_SHORTCUTS` + matching helpers (moved from app `inspector/state.ts`, `util/shortcuts.ts`).
  - `README.md`: host docs (`createExtensionHost`, `contributions`/`available`, `mount`, `run`, shortcuts, diagnostics, Vue provider, unsupported surfaces).
- histoire-vue: `HistoireProvider.extensions` + `provider/extensions.ts` (inherited host, surface contexts per session generation, reactive `available`), `provider/plugin-shortcuts.ts` (global scope, owner only, built-ins win), `panels.requestTab` for plugin navigation, `HistoireExtensionView`/`HistoireExtensionOutlet`/`keys.ts`, `ExplorerPanels` + `panel-tabs.ts` (shared descriptors, plugin tabs, sections before/after, footer, pending deep link), `ToolbarExtensions` appended in `HistoireToolbar`. Dependency `@histoire/plugin-kit: workspace:^`.
- App: `extensions/context.ts`, `plugins.ts`, `inspector/state.ts`, `util/shortcuts.ts` now re-export plugin-kit; `extensions/standalone.ts` calls `provideHistoireExtensions(workbench.host)` so the nested selected-frame provider reuses the root host; `embed/adapters/explorer-session.ts` forwards `plugin` notifications (slice 11 open issue 3); `embed/adapters/explorer-view.ts` creates a host from the book's own manifest (`virtual.d.ts` declares it).
- histoire: `build/html.ts` `generateEmbedHtml` and `virtual/embed/middleware.ts` emit the Vitest runner stub. Without it the source-origin explorer's manifest `load()` threw (`__vitest_browser_runner__.wrapDynamicImport` is injected into the manifest chunk like story imports).

Deviations:

- `standalone/mount.ts`, `App.vue` unchanged: the host is already created and disposed with the workbench (`useStandaloneExtensionHost`, slice 05); moving creation to `mount.ts` would need late-bound navigation targets in `standalone/workbench.ts`.
- Edits outside the listed files (all re-exports or one-liners, no active owner): app `extensions/context.ts`, `extensions/plugins.ts`, `extensions/standalone.ts`, `inspector/state.ts`, `util/shortcuts.ts`, `embed/adapters/explorer-view.ts`, `embed/virtual.d.ts`; histoire `build/html.ts`, `virtual/embed/middleware.ts`; `pnpm-lock.yaml` importer entry and `histoire-vue/node_modules/@histoire/plugin-kit` symlink written by hand (no `pnpm install`, per rules).
- Native explorer keeps its "Controls" label and `controls` key for `builtin:props` (existing tests and consumers use them).
- Native toolbars ignore `group`; only `global` shortcuts fire natively; plugin shortcut conflicts are reported when pressed, not at registration.
- Native surfaces use `remote` mode, so `devOnly` contributions stay hidden; the source-origin explorer uses the book's source mode.

Tests:

- plugin-kit `host-embedding.spec.ts`: plain DOM and React hosts mount/update/dispose an inspector tab via host API (test 4); SDK-backed frame service (latest actor, exact actor, release on dispose, data-only empty); default navigation.
- histoire-vue `native-extensions.spec.ts` (+ `fixtures/native-plugins.ts`): plugin tabs/sections/toolbar after shared built-ins; caller slots win (test 7); nested provider reuses host, shortcuts only on owner, built-in conflict diagnostic. `native-extensions-ownership.spec.ts`: two workbenches isolated (test 1), session replacement cleans views and keeps host (test 2), URL/title/theme/storage untouched and memory-only preferences (test 3).
- histoire `embed/integration/native-host-plugins.spec.ts`: cross-origin frame plugin ↔ host-imported workbench plugin through the SDK (test 5); data-only connection evaluates nothing and the remote host never evaluates the book's client module (test 6); source-origin explorer loads the book manifest (toolbar item in the iframe only) and forwards plugin traffic. Failed before the runner stub fix.

Commands:

- `pnpm --filter @histoire/plugin-kit build` / `test`: pass (12 files, 70).
- `pnpm --filter @histoire/vue test`: pass (147 files, 741). `pnpm --filter @histoire/vue build`: pass.
- `pnpm --filter @histoire/sdk test`: pass (29 files, 148).
- `pnpm --filter @histoire/app build`: pass. `tsc -p tsconfig.embed.json`: clean; `tsconfig.workbench.json`: only pre-existing `../App.vue` error.
- `pnpm --filter histoire build`: pass. histoire `vitest run` `ui-*`, `workbench-plugins*`, embed explorer/frame-plugin/source-document unit specs: pass (49 files).
- Embed integration: `native-host-plugins`, `plugin-channels`, `host-channels`, `frame-plugins`, `inspector-plugin-tab`, `explorer-surfaces`, `workbench-vue-plugin`, `scoped-embeds`, `vue-host-isolation`, `source-documents`, `standalone-docs-routing`, `standalone-adoption` pass (adoption failed once in the batch, passed alone). `independent-panels` "isolates host navigation…" fails at its default 1 s `expect.poll` for runtime readiness under load average ~67; a copy waiting 8 s first passes, so it is load-sensitive, not a regression.
- `pnpm --filter histoire test:embed:consumers`: pass (2 files, 5).
- eslint on changed files: clean.

Open issues:

- App `ExtensionView.vue`/`ExtensionOutlet.vue` and histoire-vue `HistoireExtensionView`/`HistoireExtensionOutlet` render views the same way with different empty/error components; the app could wrap the native ones.
- App `extensions/frame-channels.ts` `decorate()` could use `createSessionContext({ frames })` instead of its proxy.
- Native plugin shortcut conflicts are reported on key press only.
- Workbench-Vue component plugins in the source-origin explorer rely on the embed document and the manifest resolving the same `@histoire/vendors/vue` file; only DOM/toolbar contributions are proven there.
