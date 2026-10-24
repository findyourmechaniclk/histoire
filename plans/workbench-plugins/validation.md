# Validation and acceptance matrix

## Baseline

Before slice 01 edits, record `git status --short`, HEAD, and results of:

~~~bash
pnpm --filter @histoire/protocol test
pnpm --filter @histoire/sdk test
pnpm --filter @histoire/vue test
pnpm --filter histoire test
pnpm --filter @histoire/app build
pnpm --filter histoire build
pnpm run lint
~~~

Pre-existing failures are recorded, not fixed, unless a slice owns them.

## Per-slice rule

Each slice writes behavior tests first, runs its listed commands, and records results separately as: focused tests, package builds, browser proof, installed-package proof. A slice is accepted only when its own acceptance criteria and all earlier gates still pass.

## Gate matrix

| Gate | Proven by | Slices |
| --- | --- | --- |
| Root `@histoire/plugin-kit` import has no DOM, framework, Node or Vite dependency | package import test in plain Node | 01, 15 |
| Node-only plugin data never reaches browser assets | sentinel option scan of dev responses and `dist` | 02, 15 |
| `devOnly` entries absent from static output | build fixture asset scan | 02, 12, 15 |
| Plugin Vue components share workbench Vue in a React story project | browser fixture | 04, 14 |
| DOM, React, Svelte 4, Svelte 5 views mount, update, fail locally, dispose | adapter tests plus browser fixture | 04, 15 |
| Two hosts with same definitions stay isolated | host unit tests | 03, 13 |
| Stale generations cannot register, update or publish | lifecycle tests | 03, 04, 05 |
| Actions keep captured target across selection change | action runner tests | 05, 07 |
| Legacy `?tab=` and `?arrange=` values unchanged | navigation tests | 06, 09 |
| Frame budget enforced across built-in views, Matrix and plugin leases | ledger tests plus browser | 08, 09 |
| Frame modules never evaluated in collection, test worker, controls replica, MCP/screenshot documents | runtime fixtures with module-evaluation probe | 10, 15 |
| Same variant in two frames never receives the other's plugin messages | browser channel test | 11 |
| Existing host-channel tests pass unchanged | `test:embed:integration host-channels` | 11, 15 |
| Packed plugin installs without workspace aliases | `test:embed:consumers`-style packed fixture | 14, 15 |
| Teardown leaves no registrations, listeners, frame sessions or overlays | stress test toggling plugins, views, selection | 15 |

## Final commands

~~~bash
pnpm --filter @histoire/plugin-kit test
pnpm --filter @histoire/protocol test
pnpm --filter @histoire/sdk test
pnpm --filter @histoire/vue test
pnpm --filter histoire test
pnpm --filter @histoire/app build
pnpm --filter histoire build
pnpm --filter histoire test:embed:integration
pnpm --filter histoire test:embed:consumers
pnpm --filter histoire test:dev
pnpm run lint
pnpm run docs:build
~~~

Final review: unrelated changes preserved, authored modules under 300 lines, JSDoc present, no duplicated utilities or fixtures, no CSS/class assertions. Remote CI, commit, push and publication remain separate.
