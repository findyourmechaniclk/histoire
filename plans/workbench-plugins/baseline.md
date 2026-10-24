# Baseline (recorded by slice 01)

Recorded 2026-10-23, before any slice 01 edit.

- HEAD: `2387a19bf6dcf8c0a6382decac524670f72448f5` (branch `worktree-workbench-plugins`).
- `git status --short`:

~~~
?? plans/workbench-plugins/
~~~

Other agents work concurrently in this worktree; status above is what was observed at recording time.

## Test runs

| Command | Result |
| --- | --- |
| `pnpm --filter @histoire/protocol test` | pass: 19 files, 88 tests |
| `pnpm --filter @histoire/sdk test` | pass: 28 files, 143 tests |
| `pnpm --filter @histoire/vue test` | pass: 132 files, 681 tests |

Not run at baseline (expensive; per orchestrator brief): `pnpm --filter histoire test`, `pnpm --filter @histoire/app build`, `pnpm --filter histoire build`, `pnpm run lint`. Later slices that depend on them should record their first run as the effective baseline.
