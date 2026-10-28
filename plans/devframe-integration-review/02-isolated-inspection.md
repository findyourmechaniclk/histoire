# 02 — Shared readers and isolated Node API

Depends on 01. Goal: expose existing fresh-render inspection to Node callers without changing existing MCP semantics or duplicating projection logic.

## Likely paths

Current `packages/histoire/src/node/mcp/browser/inspection/{task,state,dom,diagnostics,result}.ts`, `mcp/protocol/inspection-schema.ts`, `node/api/{capture,execution,internal,project,types,index}.ts`, execution-lane ownership and test fixtures. Candidate `node/runtime/inspection/`, `node/api/{inspection,inspection-types,capture-source}.ts`, and `histoire-shared/src/inspection/` are references. Use current paths if extraction adds no meaningful reuse.

## Steps

1. Inventory each current `histoire_inspect_*`/diagnostic operation: input defaults, strict validation, source choice, queue admission, result shape/byte bound, errors, cancellation, cleanup and current test coverage. Capture behavior fixtures through public MCP API before extracting.
2. Extract only browser-safe pure projection or task pieces actually shared by live runtime and isolated execution. Keep schema adaptation, MCP public shape, transport/auth and operation retention in MCP layer. Preserve existing in-frame ARIA snapshot and diagnostic behavior. Verify Playwright serialized browser functions have no missing closure/import when moved.
3. Add `project.inspect` API only through current public Node project lifecycle, matching the original public contract. Use `variant`, `dom`, `aria` and `diagnostics` methods here; slice 07 adds `accessibility` for axe. The candidate worktree also exposes `project.inspect`; retain that single public name rather than adding an alias. Explicit `source` selects an already owned dev or built source; resolve source and revision before enqueue, copy inputs, use existing execution admission, honor signal and confirm cleanup. Preserve source lease and queue ownership if cleanup fails. Bind returned source/mode/target to captured execution; reject stale source even after await and teardown.
4. Adapt isolated results to public SDK DTO without mutating shared MCP result or weakening its bounds. Normalize errors through existing SDK error mapping; do not expose auth secrets, internal filesystem paths or arbitrary evaluation.
5. Keep MCP's existing resource handles, tool names, result envelope, operation states and errors. Add compatibility exports only if actual consumers need them; no redundant wrappers retained after review.

## Tests and gate

Use public Node project API and existing MCP fixtures: changed story vs isolated fresh state, source revision replacement before/during execution and cleanup, invalid target/selector, queued/running cancellation, timeout and cleanup failure, retained result bounds. Compare old and new MCP discovery/results and actual browser behavior for all four kinds. Run focused MCP tests and actual transport/browser integration; then package-level MCP checks. No live-session feature is implied by this slice.
