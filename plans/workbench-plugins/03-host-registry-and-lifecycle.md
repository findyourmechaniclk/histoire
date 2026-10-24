# 03 — Extension host, registry and lifecycle

## Outcome and prerequisites

Depends on: 01. Framework-neutral `createExtensionHost` installs plugins, owns registrations and tears down deterministically. No UI yet.

## Owned files

- `histoire-plugin-kit/src/host/`: `create-host.ts`, `registry.ts`, `install.ts` (setup with provisional registrations), `ordering.ts`, `diagnostics.ts`, `generation.ts` (scope generations, abort), `preferences.ts` (adapter over injected storage).
- Shared lifecycle fixtures in `histoire-plugin-kit/src/__tests__/fixtures/`.

## Tests first

1. Two hosts created from the same definitions keep separate registries, preferences namespaces and diagnostics.
2. Setup rejection removes its provisional registrations and runs disposers acquired so far, exactly once.
3. One failing plugin does not block others; `ready` settles after all.
4. Disposal during pending setup prevents late registration; disposal during pending action discards its result.
5. Duplicate qualified id rejects without replacing existing entry.
6. Reentrant and repeated disposal releases each resource once.
7. Ordering: built-ins first by their own order, then `order`, then config order, then registration order.
8. `subscribe` notifies after commit, not per provisional registration.

## Implementation steps

1. Registry keyed by qualified id, grouped by kind; immutable snapshot arrays per kind for cheap reactive consumption.
2. Install: for each definition in config order, create provisional batch, run `setup(api)`, commit batch on success or roll back on failure. `api.contribute` after commit writes directly with same ownership.
3. Generation tokens: each scope (host, selection, frame) holds an `AbortController`; operations capture the token and drop results when retired.
4. Availability predicates reevaluated on context notifications; registry exposes filtered views.
5. Preferences: JSON values under `plugin:<id>:` namespace on injected `StorageLike`; memory fallback.
6. Diagnostics: `{ pluginId, contributionId?, phase, error }`, no retry.

## API changes

`createExtensionHost`, `ExtensionHost` per public-api.md.

## Failure paths

Setup throw or rejection: plugin disabled, contributions removed, diagnostic recorded. Contribution errors handled in slices 04/05.

## Validation commands

~~~bash
pnpm --filter @histoire/plugin-kit test
pnpm --filter @histoire/plugin-kit build
~~~

## Acceptance criteria

Lifecycle tests prove stale generations cannot register or update the current host.

## Non-goals

Rendering, surface wiring, Vue integration.

## Status

Landed 2026-10-23 (uncommitted).

- `histoire-plugin-kit/src/host/`:
  - `create-host.ts`: `createExtensionHost`. Validates definitions (`defineWorkbenchPlugin`), rejects duplicate plugin ids (`load` diagnostic, first kept), installs every plugin concurrently in config order; `ready` settles after all setups settled or were disposed. `available(kind, context)`, `registerBuiltin`, `run`, idempotent reentrant `dispose`.
  - `install.ts`: per-plugin generation (child scope), provisional batch committed after setup, rollback on throw/rejection (scope aborted, acquired resources released once, nothing exposed). Late setup results after retirement: registrations refused (no-op disposer), returned disposer runs immediately, rejections discarded.
  - `plugin-api.ts`: `WorkbenchPluginApi`; helpers are sugar over `contribute`. `api.context` is a proxy whose `subscribe` is plugin-owned and released with the plugin.
  - `registry.ts`: qualified-id map, runtime kind list kept in sync with `ContributionKindMap` via `satisfies`, frozen per-kind snapshots rebuilt only for changed kinds, one notification per commit/removal/batch.
  - `ordering.ts`, `diagnostics.ts` (append-only, frozen snapshot, same error object recorded once per plugin), `generation.ts` (`createScope(...parents)`), `resources.ts` (release-once set, reverse order, late adds released immediately), `preferences.ts` (`[namespace:]plugin:<id>:<key>` JSON on injected storage; per-host memory overlay when storage absent or a write fails), `actions.ts` (`runAction` core: scope linked to owner and caller signals, discard after abort, error recorded then rethrown).
- `src/index.ts` exports `createExtensionHost`, `createScope`, `Scope`.

Type refinements (`src/types/host.ts`; public-api.md not updated, outside ownership):

- `ExtensionHost.available(kind, context)`: filtered view (`available` predicate; `devOnly` hidden unless `source.mode === 'dev'`). Throwing predicate hides the contribution for good with one `callback` diagnostic (no retry).
- `ExtensionHost.registerBuiltin(contribution)`: app-owned `builtin:` entries; plugins cannot reach the namespace (`qualifyId` rejects it).
- `ExtensionHost.run(id, context, options?: ExtensionRunOptions)`: `options.signal` is the caller's captured target scope. Resolves without result when owner, host or caller scope retired first; otherwise rejects with the action error.
- `subscribe` also fires on root context changes and new diagnostics.
- `PluginDiagnosticPhase` adds `callback` (predicates, preference listeners) and `report` (`api.reportError`).
- New types `ContributionContext<K>`, `ExtensionRunOptions`.

Deviations:

- `actions.ts` lands here (planned for 05) because `ExtensionHost.run` needs it; core only. Pending state is the returned promise; surface wiring stays in 05.
- Extra files `plugin-api.ts`, `resources.ts` to keep modules small.
- Unset `order` sorts as `0`. Built-ins sort by their own `order`, then registration order.
- `ExtensionHost.mount` throws "not implemented"; slice 04 owns the mount manager.
- `api.frames.list()` returns `[]`, `api.frames.open` throws "not implemented"; slice 11.
- Rejected registrations (unknown kind, invalid or duplicate id) throw and record a `register` diagnostic.

Tests (`src/__tests__/`, shared fixtures `fixtures/host.ts`): `host-setup.spec.ts` (atomic commit with single notification, rollback releasing resources once, failing plugin isolated, `ready` after all, duplicate rejection, invalid kinds/ids, post-setup ownership, invalid/duplicate definitions, options), `host-disposal.spec.ts` (disposal during pending setup, reentrant/repeated disposal, owned context subscriptions, disposer failures, action capture/abort/discard/errors), `host-registry.spec.ts` (ordering, built-ins, snapshot identity, availability, `devOnly`, predicate failure, host isolation, storage namespacing), `preferences.spec.ts`.

Commands:

- `pnpm --filter @histoire/plugin-kit build`: pass.
- `pnpm --filter @histoire/plugin-kit test`: pass (7 files, 50 tests; type fixtures pass).
- `npx eslint packages/histoire-plugin-kit/src`: clean.

Open issues:

- public-api.md "Host API" should list `available`, `registerBuiltin`, `run` options and new diagnostic phases.
- Frame-menu `children` actions are not runnable through `host.run`; slice 07 decides their id scheme.
- Preferences ignore cross-tab `storage` events; slice 05 `storage.ts` may add that.
