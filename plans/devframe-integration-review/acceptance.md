# Acceptance, test and evidence contract

## Observable acceptance

| Scenario | Required observation |
| --- | --- |
| Disabled by default | No inspection instrumentation, Devframe listener, connection or extra dependency required; existing SDK and isolated MCP continue to work |
| Live vs isolated | Mutate mounted story without saving; live SDK and authorized live MCP report that value and same target; isolated API reports fresh state, with mode/source explicit |
| Exact target | Two mounted variants and two sessions: request reaches only named active target, including a non-selected mounted target if current canvas exposes it; unmounted target fails rather than selecting/remounting |
| Replacement and cancellation | Pause each async stage, replace source/document/mount or connection, repeat a visit to the same selection, or withdraw permission, then release; old request cannot publish success or side effects. Explicit-target work surviving an unrelated selection change remains valid. Cancellation reaches remote work and owned resources close |
| Cross-origin | Actual distinct browser origins use existing authenticated bridge; unallowed origin rejected. Node shims and same-origin tests do not prove this |
| Security | Two authenticated principals, projects and peers: discovery, reads, resources and highlights respect grants and policy; wrong/expired/replayed grant fails; no IDs, secrets or data leak |
| Bounds | Cycles, hostile getters, large state/DOM/diagnostics and oversized input stop within time, depth and byte budgets; detached result includes truncation/loss where applicable |
| Existing MCP | Tool discovery, schema, operation queue, polling, errors, output, diagnostics, ARIA semantics and resource ownership retain old contract on dev and owned stdio |
| Framework and a11y | Vue fragments, slots, teleport, async and unmount exercise actual component ownership; unsupported cases explicit. Live SDK/MCP and fresh isolated Node axe audits use the exact story document and label their mode; ARIA snapshot remains separate |
| Component events | Authorized live MCP pages existing target-attributed component events in sequence with bounded loss/gap information; events-only grants do not activate diagnostic instrumentation |
| Lifecycle | Double attach/dispose, replacement, disconnect, host shutdown, HMR, policy withdrawal and observer teardown leave no stale registrations, pending calls, timers or caller-resource closure |
| Distribution | Packed consumer outside workspace imports SDK without optional adapter; explicit client/server adapter imports work without accidental Node in browser or DOM at Node import. Missing optional packages fail only activated features |

## Evidence levels

- **Focused:** file-targeted behavior tests; record exact commands and failure/success.
- **Integration:** real source/bridge or actual MCP/Devframe transport, separate from fake peers.
- **Browser:** real Chromium and distinct origins where required; record source, target and runtime. Browser screenshot alone does not prove behavior.
- **Package:** install tarballs outside workspace without aliases; record Node version, package resolution and optional dependencies.
- **Broad:** affected package suites, scoped lint/typecheck, build, docs and applicable repository guards. Run shared builds serially where outputs overlap. Only broaden after focused checks pass or changes require it.
- **CI/publish:** only actual remote results count; local proof is not CI or release proof.

Suggested baseline commands, after checking the exact scripts and dependencies in the integration tree:

```sh
pnpm --filter @histoire/protocol test
pnpm --filter @histoire/sdk test
pnpm --filter histoire exec vitest run src/node/__tests__/mcp/inspection-tools.spec.ts src/node/__tests__/mcp/inspection-browser.spec.ts
pnpm --filter histoire test:embed:integration
pnpm --filter histoire test:embed:consumers
pnpm --filter histoire test:mcp:integration
pnpm --filter histoire test:mcp:package
pnpm run build
pnpm run docs:build
git diff --check
```

Adapter scripts and new targeted test paths become runnable only after creation; do not report anticipated commands as executed. Run browser/listener tests only where environment permits; capture exact environment errors and mark blocked evidence rather than treating restrictions as product failures. Establish baseline failures before changing shared code. Mutation/fault probes should demonstrate important tests fail when ownership, bound or cancellation guard is removed; avoid duplicating the test suite.

## Slice receipt template

Record in the slice handoff or a new evidence file:

```text
Slice: ...
Main baseline and integration worktree: ...
Candidate snapshot ID / manifest, file archive, history bundle and restore hashes: ...
Paths and starting/ending ownership: ...
Decisions: retained / adapted / replaced / deferred / discarded, with rationale
Contracts and compatibility changes: ...
Focused / integration / browser / package / broad checks: command, outcome, environment
Review findings: severity, evidence, resolution or explicit blocker
Remaining risks and next gate: ...
```

A receipt is evidence for the exact tree tested; changes after the run invalidate affected checks. No staging, commits, push, publication or deployment is authorized by these plans.
