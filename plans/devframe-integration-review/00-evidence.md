# Slice 00 preservation and review receipt

Recorded 2026-10-28. Source HEAD `a7ddbe5740aec6bb2a79c999285e55e56ea0bab2`; base `41565ecaedebe10350909d293461b21737aa1fd8`; destination main `d6c8238c7eea443649f1ae9539b05bb16c69fa4f`. Destination contains untracked `.claude/` and this plan pack; preserve them. Source has 43 tracked modifications and 82 untracked paths; source index diff is empty.

## Preservation

Snapshot: `/tmp/histoire-devframe-preservation-20261028-133418` (temporary storage; copy to durable storage before cleanup). `candidate-files.tar` SHA-256 `a8411359ee073fcebb3e796ed744ec461637be19ed8b05d3a8eb9332724722c2`; `history.bundle` SHA-256 `57b4ce66fe85d7894b6633be6856bd2cc598f64a35802e92871106af91c24676`; `manifest.json` SHA-256 `45867d5b3af30169594e79022d5b9900a3078f8d7b2707a02b97e868977b59d7`. `SHA256SUMS` records index, binary diffs and status hashes. Archive retains file modes and symlink targets. Full source index and source/destination status, index and worktree diffs are saved. No source staged changes.

Fetched bundle into a fresh empty Git repository, checked out source HEAD, restored index and archive, verified each file hash and mode, and matched NUL-delimited source status exactly. Verified both commits and ancestry `41565eca` < `220ba31e` < `a7ddbe57`. Source status and all manifest contents/modes matched before and after capture. Destination status before and after recorded separately; source ignored `node_modules/` and package `dist/` excluded as dependencies/build output. The historical `@modelcontextprotocol/node` test dependency is missing from candidate package node_modules; dependencies must be resolved in a separate authorized workspace before its transport probe can be repeated. No credentials intentionally captured. No ignored artifact identified as source; generated frozen protocol test fixture is untracked and included.

## Local commits

- `220ba31e`: discard commit as transplant. Current `StoryInspector.vue` defines menu handlers in its script; compare current behavior when testing.
- `a7ddbe57`: discard commit as transplant. `SearchPanel.vue` now owns empty result rendering via `WorkbenchEmptyState`; old `SearchEmpty.vue` was removed as part of current UI architecture.

## Flow and review disposition

- **Slice 01:** candidate extends protocol payload/capabilities and adds validators; adapt rather than overwrite current stricter bridge. Test old/new peers, invalid inputs and policy intersection. Source docs describe slice 01 only while later private code exists.
- **Slice 02:** existing MCP inspection feeds browser task, result bounds and execution lanes; candidate extracts readers into shared/runtime modules and adds public Node API. Review flagged signal admission, mutable DTOs and MCP parity; test existing tool schemas, output/error envelopes and lifecycle under real queue cancellation before replacing any path.
- **Slice 03:** SDK session methods traverse authenticated bridge, embed runtime request and runtime-local state/DOM/highlight reader. Review flagged target ownership, stale origin-policy and cancellation risks; bind exact selected or explicit target and recheck authority at every async boundary, with browser regressions. Grid-era assumptions require adaptation to current canvas.
- **Slice 04:** diagnostic subscription starts runtime instrumentation, polls bounded pages, stops on unsubscribe or owner change; prove registration cancellation, shared observers, stale callbacks and exact ownership with public behavior tests. Historical tests are not browser lifecycle proof.
- **Slices 05–06:** public adapter client and node entries export types only. Grants, registry, discovery and dispatch are private helpers; no reachable browser attachment, pairing host, live MCP service or cleanup is proven. Independent review flagged asynchronous authorization expiry/revocation, cancellation and final authority checks; implement transport only with authenticated host principal and explicit lifecycle. `grant` hashes tokens, binds source/principal and consumes once; maintain this boundary and test replay/expiry/owner turnover.
- **Slices 07–09:** component inspection, accessibility audits, workbench plugin surfaces, WebMCP and packaging are deferred until their own gates; no feature claim from DTOs or probes. Current workbench uses plugin kit and Tailwind; do not copy old UI wholesale. Source integration probes exercise real Devframe WebSocket and MCP TCP seams but not integrated Histoire browser/adapter.

Review priorities: security/authority and stale writes are release blockers for promised live features; Node and MCP parity are blockers for isolated integration; diagnostics ownership precedes broker; packaging and current browser proof remain later gates. These are review leads, not reproduced product defects in current main. Cite independent review reports for exact reproductions and line evidence.

## Prioritized candidate findings

These findings concern the preserved candidate, not current main. They are source-review findings; targeted public behavior reproductions remain required before implementing each slice.

- **P1, slice 03 — target and authority:** `packages/histoire-sdk/src/session/inspection/index.ts:18–24,33–43` captures an explicit target but sends current selection in the transport envelope. Its guard does not fully bind session, connection, mount, target and selection generations or re-evaluate origin policy. Rework admission and post-await guards against current main; exercise two mounted targets, replacement, policy revocation and cancellation in a real browser.
- **P1, slices 05–06 — cancellation and authorization:** `packages/histoire-devframe/src/node/dispatch.ts:31–39` checks abort before awaiting final authorization, but not after it, allowing cancellation or timeout during that await to return success. `registry.ts:31–37,61–79` can revive expired heartbeat via `update` and can let lease expiry or changed policy race asynchronous authorization. Fence every await, retire stale leases before update, and test suspended authorization, revocation and elapsed expiry. Helpers are private and public entries have no live adapter implementation, so impact is on future integration, not an exposed current endpoint.
- **P2, slice 02 — malformed signals and mutable results:** `packages/histoire/src/node/api/inspection.ts:19–21,37–45` admits `signal` without validation, enqueues before use, and shallow-copies result before bounding; `runtime/inspection/result.ts:6–24` mutates nested arrays/objects. Validate signal before admission, create independent result ownership, and test invalid/already-aborted signals and shared result preservation. Prove existing MCP behavior and error envelopes under extraction.
- **P2, slice 03 — cancellation and timeouts:** `packages/histoire-sdk/src/session/inspection/index.ts:29–31,40–50` needs end-to-end proof that abort and timeout propagate to actual runtime work and cannot publish stale success. Test held and reentrant operations, document replacement, permission withdrawal and exact remote cleanup before advertising availability.

## Compatibility and baseline

Local package metadata confirms exact `devframe` 1.2.2 and `@devframes/agentic` 1.2.2 reciprocal peer; MCP server/client 2.3.1 require Node >=20; project and adapter declare Node >=22.12.0. Proposal: retain exact candidate pins only pending fresh public API, transport and packaging verification; do not claim broader version ranges or all supported Node versions. `@modelcontextprotocol/node` 2.1.0 is declared test-only but package symlink absent. Local installed declarations confirm `initDevframe`, disconnect hooks, RPC authorization and `createMcpFetchHandler` with shared-state control; MCP declarations expose request authentication context. Historical compatibility receipt is included in archive and must not be treated as current passing evidence. Re-prove the exact upstream transport seam before enabling slices 05–06.

Independent baseline agent reports current main on direct Node 24: targeted Histoire 32 tests, protocol 93 tests and SDK 146 tests passed. Initially sandbox-blocked child-process imports, loopback and Chromium were retried with escalation; imports passed and Chromium ran. These are baseline results, not candidate or end-to-end proof. Candidate checks were not run in source to avoid writes or installing dependencies.

## Path-level transplant map

Comparison is source snapshot bytes against current main at recorded HEAD; `absent` alone never establishes obsolescence. All `Adapt` paths require behavior review before editing, and do not authorize whole-file replacement. `Defer` preserves historical reference for later slices.

| Candidate path | Main comparison | Decision | Disposition |
| --- | --- | --- | --- |
| `packages/histoire-app/src/embed/adapters/runtime-frame.ts` | different | Adapt | Slice 03: reconcile current runtime ownership and mounted targets. |
| `packages/histoire-app/src/embed/adapters/runtime-requests.ts` | different | Adapt | Slice 03: reconcile current runtime ownership and mounted targets. |
| `packages/histoire-app/src/embed/commands.ts` | different | Adapt | Slice 03: reconcile current runtime ownership and mounted targets. |
| `packages/histoire-app/src/embed/view-session.ts` | different | Adapt | Slice 03: reconcile current runtime ownership and mounted targets. |
| `packages/histoire-protocol/src/bridge/catalog.ts` | different | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/bridge/envelope.ts` | different | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/bridge/payload.ts` | different | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/bridge/results.ts` | different | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/bridge/snapshot.ts` | different | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/bridge/types.ts` | different | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/index.ts` | different | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/types/catalog.ts` | different | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/types/error.ts` | different | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/types/snapshot.ts` | different | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-sdk/src/adapters/types.ts` | different | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-sdk/src/session/context.ts` | different | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-sdk/src/session/controller.ts` | different | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-sdk/src/session/ownership.ts` | different | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-sdk/src/session/request.ts` | different | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-sdk/src/session/runtime.ts` | different | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-sdk/src/transport/inbound.ts` | different | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-sdk/src/transport/port.ts` | different | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-sdk/src/transport/session-commands.ts` | different | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-sdk/src/transport/validation.ts` | different | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-sdk/src/types.ts` | different | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-shared/package.json` | different | Adapt | Slice 02: reuse bounded readers and existing shared package exports. |
| `packages/histoire-shared/src/types/config.ts` | different | Adapt | Slice 02: reuse bounded readers and existing shared package exports. |
| `packages/histoire/src/node/__tests__/embed/node-capture.spec.ts` | different | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire/src/node/__tests__/utils/embed/bridge-fixture.ts` | different | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire/src/node/api/capture.ts` | different | Adapt | Slice 02: merge into current project, capture and execution lanes. |
| `packages/histoire/src/node/api/index.ts` | different | Adapt | Slice 02: merge into current project, capture and execution lanes. |
| `packages/histoire/src/node/api/project.ts` | different | Adapt | Slice 02: merge into current project, capture and execution lanes. |
| `packages/histoire/src/node/api/types.ts` | different | Adapt | Slice 02: merge into current project, capture and execution lanes. |
| `packages/histoire/src/node/mcp/browser/inspection/diagnostics.ts` | different | Adapt | Slice 02: preserve existing MCP schemas, errors, bounds and cancellation. |
| `packages/histoire/src/node/mcp/browser/inspection/dom.ts` | different | Adapt | Slice 02: preserve existing MCP schemas, errors, bounds and cancellation. |
| `packages/histoire/src/node/mcp/browser/inspection/result.ts` | different | Adapt | Slice 02: preserve existing MCP schemas, errors, bounds and cancellation. |
| `packages/histoire/src/node/mcp/browser/inspection/state.ts` | different | Adapt | Slice 02: preserve existing MCP schemas, errors, bounds and cancellation. |
| `packages/histoire/src/node/mcp/browser/inspection/task.ts` | different | Adapt | Slice 02: preserve existing MCP schemas, errors, bounds and cancellation. |
| `packages/histoire/src/node/runtime/browser/errors.ts` | different | Adapt | Compare current owner and behavior before transplant. |
| `packages/histoire/src/node/virtual/embed/descriptor.ts` | different | Adapt | Slices 03–04: reconcile current runtime and document ownership. |
| `packages/histoire/src/node/virtual/preview-runtime/message-handler.ts` | different | Adapt | Slices 03–04: reconcile current runtime and document ownership. |
| `packages/histoire/src/node/virtual/preview-runtime/runtime-service.ts` | different | Adapt | Slices 03–04: reconcile current runtime and document ownership. |
| `pnpm-lock.yaml` | different | Adapt | Regenerate targeted entries from reviewed package decisions; never replace main lockfile. |
| `packages/histoire-app/src/embed/adapters/inspection.ts` | absent | Adapt | Slice 03: reconcile current runtime ownership and mounted targets. |
| `packages/histoire-devframe/COMPATIBILITY.md` | absent | Adapt | Historical receipt/documentation; refresh installed API evidence and actual capability. |
| `packages/histoire-devframe/README.md` | absent | Adapt | Historical receipt/documentation; refresh installed API evidence and actual capability. |
| `packages/histoire-devframe/package.json` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/src/__tests__/consumers/imports.spec.ts` | absent | Adapt | Use real public transport tests; current internal probes do not prove wired product. |
| `packages/histoire-devframe/src/__tests__/grants.spec.ts` | absent | Adapt | Use real public transport tests; current internal probes do not prove wired product. |
| `packages/histoire-devframe/src/__tests__/integration/devframe.spec.ts` | absent | Adapt | Use real public transport tests; current internal probes do not prove wired product. |
| `packages/histoire-devframe/src/__tests__/integration/mcp.spec.ts` | absent | Adapt | Use real public transport tests; current internal probes do not prove wired product. |
| `packages/histoire-devframe/src/client/index.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/src/node/contracts.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/src/node/discovery.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/src/node/dispatch.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/src/node/grants.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/src/node/index.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/src/node/registry.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/src/node/types.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/src/shared/services.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/src/shared/validation.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/src/types.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/tsconfig.json` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-devframe/vitest.config.ts` | absent | Adapt | Optional adapter contracts/private helpers; public entries are type-only; wire only after security review. |
| `packages/histoire-protocol/src/__tests__/consumers/inspection-readonly.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire-protocol/src/__tests__/fixtures/generated/inspection-reader-v1.mjs` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire-protocol/src/__tests__/inspection-capabilities.spec.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire-protocol/src/__tests__/inspection-extensions.spec.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire-protocol/src/__tests__/inspection-readonly.spec.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire-protocol/src/__tests__/inspection.spec.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire-protocol/src/inspection/capabilities.ts` | absent | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/inspection/debug-buffer.ts` | absent | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/inspection/extensions.ts` | absent | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/inspection/rows.ts` | absent | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/inspection/validation.ts` | absent | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/types/debug.ts` | absent | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/types/inspection-accessibility.ts` | absent | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/types/inspection-components.ts` | absent | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/types/inspection.ts` | absent | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-protocol/src/types/isolated-inspection.ts` | absent | Adapt | Slice 01: merge bounded contract into current strict wire validators. |
| `packages/histoire-sdk/src/__tests__/debug.spec.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire-sdk/src/__tests__/inspection.spec.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire-sdk/src/session/debug.ts` | absent | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-sdk/src/session/inspection/index.ts` | absent | Adapt | Slices 03–04: reconcile current session ownership, cancellation and policy. |
| `packages/histoire-shared/src/inspection/diagnostics.ts` | absent | Adapt | Slice 02: reuse bounded readers and existing shared package exports. |
| `packages/histoire-shared/src/inspection/dom.ts` | absent | Adapt | Slice 02: reuse bounded readers and existing shared package exports. |
| `packages/histoire-shared/src/inspection/index.ts` | absent | Adapt | Slice 02: reuse bounded readers and existing shared package exports. |
| `packages/histoire-shared/src/inspection/state.ts` | absent | Adapt | Slice 02: reuse bounded readers and existing shared package exports. |
| `packages/histoire-shared/src/types/config-inspection.ts` | absent | Adapt | Slice 02: reuse bounded readers and existing shared package exports. |
| `packages/histoire/src/node/__tests__/embed/integration/inspection.spec.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire/src/node/__tests__/embed/node-inspection.spec.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire/src/node/__tests__/inspection-config.spec.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire/src/node/__tests__/inspection-debug.spec.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire/src/node/__tests__/utils/embed/capture-source.ts` | absent | Adapt | Retain behavior intent; use current fixtures and add public lifecycle/transport coverage. |
| `packages/histoire/src/node/api/capture-source.ts` | absent | Adapt | Slice 02: merge into current project, capture and execution lanes. |
| `packages/histoire/src/node/api/inspection-types.ts` | absent | Adapt | Slice 02: merge into current project, capture and execution lanes. |
| `packages/histoire/src/node/api/inspection.ts` | absent | Adapt | Slice 02: merge into current project, capture and execution lanes. |
| `packages/histoire/src/node/config/inspection.ts` | absent | Adapt | Slice 01: integrate disabled defaults and policy intersection. |
| `packages/histoire/src/node/runtime/inspection/diagnostics.ts` | absent | Adapt | Slice 02: verify behavior parity with current MCP readers. |
| `packages/histoire/src/node/runtime/inspection/result.ts` | absent | Adapt | Slice 02: verify behavior parity with current MCP readers. |
| `packages/histoire/src/node/runtime/inspection/state.ts` | absent | Adapt | Slice 02: verify behavior parity with current MCP readers. |
| `packages/histoire/src/node/runtime/inspection/task.ts` | absent | Adapt | Slice 02: verify behavior parity with current MCP readers. |
| `packages/histoire/src/node/virtual/preview-runtime/debug-service.ts` | absent | Adapt | Slices 03–04: reconcile current runtime and document ownership. |
| `packages/histoire/src/node/virtual/preview-runtime/inspection-service.ts` | absent | Adapt | Slices 03–04: reconcile current runtime and document ownership. |
| `plans/devframe-inspection/01-contracts-and-compatibility.md` | different | Defer | Historical reference; compare to current integration plan, preserve original. |
| `plans/devframe-inspection/02-shared-inspection-core.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/03-live-browser-sdk.md` | different | Defer | Historical reference; compare to current integration plan, preserve original. |
| `plans/devframe-inspection/04-node-sdk-and-mcp-parity.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/05-debug-timeline.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/06-devframe-browser-attachment.md` | different | Defer | Historical reference; compare to current integration plan, preserve original. |
| `plans/devframe-inspection/07-live-session-broker.md` | different | Defer | Historical reference; compare to current integration plan, preserve original. |
| `plans/devframe-inspection/08-agent-tools-and-discovery.md` | different | Defer | Historical reference; compare to current integration plan, preserve original. |
| `plans/devframe-inspection/09-vue-component-inspection.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/10-accessibility-audits.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/11-workbench-and-vue-panels.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/12-devtools-hosts-and-reports.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/13-optional-webmcp.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/14-packages-examples-and-docs.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/15-conformance-and-delivery.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/README.md` | different | Defer | Historical reference; compare to current integration plan, preserve original. |
| `plans/devframe-inspection/architecture.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/contracts.md` | different | Defer | Historical reference; compare to current integration plan, preserve original. |
| `plans/devframe-inspection/coordination.md` | identical | Already integrated | Candidate bytes match main; retain current file. |
| `plans/devframe-inspection/evidence.md` | different | Defer | Historical reference; compare to current integration plan, preserve original. |
| `plans/devframe-inspection/validation.md` | different | Defer | Historical reference; compare to current integration plan, preserve original. |

## Gate status

Preservation, path inventory, independent source-review triage and representative main baseline checks complete. Exact upstream transport proof remains a blocker for slices 05–06; candidate behavior reproductions and browser conformance are required in their respective slices. Independent contracts and Node work may proceed. Source and destination may change concurrently; recheck before each edit.

## Slice 07 accessible-name limitation

Axe 4.14 `NodeResult` does not provide an accessible name. Its typed `commons.text.accessibleText(element)` depends on axe's internal node map; in a real Chromium probe it failed after `axe.run` cleared that map. Rebuilding axe's private tree would use undocumented internals and can invoke story DOM getters. The audit therefore leaves optional `accessibleName` absent rather than inferring it from `aria-label`, which `aria-labelledby` can override. This does not establish accessible names for audit findings, so that part of slice 07's original acceptance remains incomplete.

The real axe Chromium fixture passed with conflicting `aria-label` and `aria-labelledby`, confirming the named violation has no fabricated `accessibleName`. The same test covers story-root scoping, live repair, missing engine, timeout, cancellation, owner retirement, and subsequent scanner recovery. This is scanner-level evidence; it does not prove live SDK, MCP, or isolated Node wiring.
