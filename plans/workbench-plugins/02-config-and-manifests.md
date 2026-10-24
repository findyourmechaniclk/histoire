# 02 — Config resolution and browser manifests

## Outcome and prerequisites

Depends on: 01. Configured `workbench.client` and `workbench.frame` entries load lazily in dev and static builds. Node plugin objects stop reaching the browser.

## Owned files

- `histoire/src/node/virtual/resolved-config.ts`: explicit strip of `plugins` and object-valued `vite`. Land first; standalone value.
- `histoire/src/node/config/workbench-plugins.ts` (new): validate descriptors (id format, uniqueness, `apiVersion`, entry presence, JSON-serializable `options`), resolve entries.
- `histoire/src/node/context.ts`: collect `ctx.workbenchPlugins` next to `registeredCommands` (`:69-72`).
- `histoire/src/node/virtual/index.ts`, `vite-plugin.ts`: ids `virtual:$histoire-workbench-plugins`, `virtual:$histoire-frame-plugins` (`/__resolved__` form).
- `histoire/src/node/virtual/resolved-workbench-plugins.ts`, `resolved-frame-plugins.ts` (new): generated lazy loaders.
- `histoire/src/node/virtual/resolved-commands.ts`: reimplement `clientSetupFile` import through the same resolution helper.
- `histoire/src/node/vite/resolve-paths.ts`, `core-plugin.ts`: add plugin entry package dirs to `server.fs.allow`.
- `histoire-app/src/virtual.d.ts`: declare new modules.
- Node fixtures under existing `histoire` test fixtures; reuse current temp-project helpers.

## Tests first

1. Project-local entry, installed package entry, missing entry, duplicate id, `builtin` id, unsupported `apiVersion` each produce expected manifest or attributed config error.
2. Entry paths containing spaces and quotes generate valid modules (use `JSON.stringify` for specifiers, as `resolved-support-plugins-client.ts` does).
3. Sentinel string placed in a Node-only plugin field never appears in dev responses for `virtual:$histoire-config` or in `dist` assets.
4. `devOnly` entries and their transitive assets absent from static build output.
5. Manifest order equals resolved plugin order (`config/merge.ts:41-53`).
6. Existing `clientSetupFile` command fixture still runs its client action.

## Implementation steps

1. Strip `plugins`/object `vite` in `resolved-config.ts`; confirm no app code reads `config.plugins` in browser (grep `histoire-app`, `histoire-vue`).
2. Resolve entries with Vite `this.resolve(specifier, root + '/index.html', { skipSelf: true })` inside `load`, matching `setupFile` (`vite-plugin.ts:40-42`); fall back to error with plugin id.
3. Generate `export const workbenchPlugins = [{ id, apiVersion, options, load: () => import(<resolved>) }]`; options via `JSON.stringify` after validation.
4. Frame manifest identical shape for `frame` entries.
5. In build mode with `devOnly`, omit entries before generation.
6. Add package directories of resolved entries to `server.fs.allow`.
7. Do not invalidate manifests on file change; config edits restart via existing watcher. Client module HMR stays Vite's.

## API changes

Behavior for `Plugin.workbench`. `virtual:$histoire-config` no longer contains `plugins` (internal virtual module; check no consumers).

## Failure paths

Config errors fail startup with plugin id and field. Unresolvable entry fails startup, not first import. Non-JSON options fail validation.

## Validation commands

~~~bash
pnpm --filter histoire test
pnpm --filter histoire build
pnpm --filter @histoire/app build
pnpm --filter histoire test:dev
pnpm run lint
~~~

## Acceptance criteria

- A configured plugin entry loads in dev and in a built book.
- No framework compiler added implicitly.
- Config output contains no plugin objects.

## Non-goals

Executing plugin setup (03), vendor-Vue resolution (04), frame evaluation gating (10).

## Status

Prerequisite part only (implementation step 1), 2026-10-23.

- Landed: `histoire/src/node/virtual/resolved-config.ts` destructures `plugins` and `vite` out of the browser config in dev and build modes. `vite` is stripped whatever its type (object or function), not only when object-valued.
- Browser consumers checked: no read of `config.plugins` or `config.vite` in `histoire-app`, `histoire-vue`, `histoire-sdk` or `histoire-plugin-*` client code. Only importer of `virtual:$histoire-config` is `histoire-app/src/app/util/config.ts`; `config.plugins` hits in plugin packages are Node-side Vite config.
- Test added: `histoire/src/node/__tests__/ui-public-config.spec.ts`, sentinels in a plugin field and a Vite option never appear in generated module code (dev and build). Unit-level against the generator; dev-response and `dist` parts of test 3 remain for the full slice.
- Commands: `pnpm --filter histoire test` pass (349 files, 1847 tests); `pnpm --filter @histoire/app build` pass; eslint on changed files pass.
- Open: rest of slice 02 (descriptors, manifests, `fs.allow`, `clientSetupFile`).

### Full slice, 2026-10-23

- Landed:
  - `histoire/src/node/config/browser-entries.ts` (new): shared `createBrowserEntryResolver` (Vite `config.createResolver()`, importer `<root>/index.html`: bare specifiers with browser conditions and aliases, `./x` and `/x` root-relative, absolute files kept), `PluginBrowserConfigError` (`[histoire] plugin "<name>" workbench.<field>: ...`), `resolveCommandClientSetupFiles`.
  - `histoire/src/node/config/workbench-plugins.ts` (new): descriptor validation (object, id grammar, `builtin` reserved, `apiVersion: 1`, at least one entry, string entries, boolean `devOnly`, options through `measureWireValue(..., { mode: 'json' })`), duplicate ids naming both plugins, resolution in config order.
  - `context.ts`: `ctx.workbenchPlugins` and `ctx.commandClientSetupFiles` resolved after `configResolved`, so bad entries fail startup.
  - `virtual/index.ts`, `vite-plugin.ts`, `resolved-workbench-plugins.ts`, `resolved-frame-plugins.ts`: `virtual:$histoire-workbench-plugins` (`workbenchPlugins`) and `virtual:$histoire-frame-plugins` (`framePlugins`), `/__resolved__` form, entries `{ id, apiVersion, options, load: () => import(<JSON specifier>) }`. Not invalidated on file change.
  - `resolved-commands.ts`: `clientSetupFile` imports the startup-resolved file with `JSON.stringify` specifiers.
  - `vite/resolve-paths.ts` `resolveWorkbenchPluginAllowPaths` (nearest `package.json` dir of each entry), added to `server.fs.allow` in `core-plugin.ts`.
  - `histoire-app/src/virtual.d.ts`: both manifest modules declared (`load` returns `{ default: unknown }`; slice 05 may narrow to plugin-kit types once the app depends on it).
- Deviations:
  - Step 2: entries resolve at context creation via Vite's config resolver, not `this.resolve` in `load`. Reason: failure paths require startup failure, and `fs.allow` needs real paths before the server config is final. Plugin `resolveId` hooks therefore do not apply to entries (aliases and package resolution do).
  - `clientSetupFile` resolves at startup through the same helper; an unresolvable file now fails startup with the command id instead of a browser import error. It stays an eager import (commands spread its exports synchronously), not a manifest entry.
  - Build mode validates dev-only descriptors but skips resolving them (dev-only deps may be absent in build installs); the generator also filters them by resolved Vite command.
  - Id grammar duplicated as a regex: `histoire` has no dependency on `@histoire/plugin-kit` (`isValidPluginId`).
  - Vite trusts modules reached through the import graph regardless of `fs.allow`; the allow list matters for raw files a package references without importing (CSS `url()` fonts, `new URL()` assets).
- Tests added (`histoire/src/node/__tests__/`):
  - `workbench-plugins-config.spec.ts`: local and installed package entries, root-relative, config order, 9 attributed failures, duplicates, dev-only skipped in build, command setup resolution and attributed failure, `createContext` collection and startup failure.
  - `workbench-plugins-manifest.spec.ts`: lazy loading, order, specifiers with spaces and quotes, frame vs client split, dev-only omitted in build, command imports parse.
  - `workbench-plugins-serve.spec.ts`: real dev server over HTTP (manifest, package entry outside root, package asset served thanks to `fs.allow` (403 without it, checked), command setup module, config without Node sentinel); Vite build (non-dev-only entries bundled, dev-only entry and its transitive import absent, sentinel absent).
  - Shared fixture `utils/workbench-plugin-project.ts`, built on `createMcpProjectFixture`.
- Commands:
  - Focused `vitest run` of the three specs plus `ui-public-config.spec.ts`: pass (25 tests).
  - `pnpm --filter histoire test`: first run collided with a concurrent app build (14 files failed); second run had 6 load-sensitive failures (`acp-manager`, `test-lifecycle`, `test-specs`, `test-targeting`, `mcp/test-cancellation`, `variant-test-session/matching`). Every failing file passes when rerun alone.
  - `vitest run --config vitest.embed.config.ts standalone-adoption.spec.ts`: pass (existing `clientSetupFile` command fixture, dev and static).
  - `pnpm --filter histoire build` pass; `pnpm --filter @histoire/app build` pass; eslint on changed files pass. `test:dev` is watch mode, covered by `test`. Repo-wide `pnpm run lint` not run (other agents mid-edit).
- Open: build proof uses a minimal Vite build with the real virtual-files plugin, not a full book build, because the app does not import the manifests until slice 05. Slice 05 should extend the `dist` scan to a full `histoire build`.
