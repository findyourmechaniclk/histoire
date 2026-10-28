# 07 — Vue component inspection and story-scoped accessibility

Depends on 02, 03 and 06. Goal: inspect actual Vue ownership and run optional story-scoped accessibility audits through live SDK, isolated Node API and authorized live MCP; preserve generic inspection for other frameworks.

## Likely paths

Current `packages/histoire-plugin-vue/src/client/`, `packages/histoire/src/node/virtual/preview-runtime/element-inspection.ts`, runtime bridge, protocol inspection DTOs, and new shared a11y service if needed. Existing plugin hooks and host APIs must be traced first. Candidate inspection schemas and earlier plans provide inputs, not evidence of implemented features.

## Steps

1. Define a framework hook for bounded component tree/detail projection; never expose a raw component instance or execute arbitrary code. The runtime identifies actual owning component of selected DOM element and reports finite names, hierarchy, safe props/state projection, source metadata and explicitly partial/unavailable cases. Avoid getters, cycles, private tokens and framework internals as public contracts.
2. Implement Vue adapter against supported Vue versions. Handle or explicitly report fragments, slots, teleport, async components, KeepAlive, unmounted owners and multiple roots. Recheck document/owner after DOM lookup and async data retrieval. React/Svelte report generic DOM support and component capability unavailable, not synthetic Vue results.
3. Integrate one optional axe scanner within the exact story document/root, not workbench shell. Normalize bounded violations/nodes, accessible labels, truncation, timeout and error types. Loading, absent dependency, cancellation or replaced document must not produce an old result. Existing Playwright ARIA snapshot remains a distinct isolated operation.
4. Expose scanner through browser `session.inspect.accessibility`, public Node `project.inspect.accessibility` and authorized live MCP `histoire_audit_session_accessibility`, using the same result semantics. Node audit uses slice 02’s explicit source-owned execution lane and fresh isolated document, validates the source/revision at admission and completion, honors cancellation and joins cleanup; return `mode: isolated` with captured identity. Live SDK/MCP use the mounted document and live authority. Never fall back between modes. Keep `project.inspect.aria` and the legacy MCP ARIA snapshot unchanged.
5. Expose only implemented capabilities via SDK and authorized live services. Decide which compliance rules/defaults are part of contract; avoid implying complete accessibility compliance. Keep a11y dependency optional and browser-safe; no dynamic install or silent external network fetch.

## Tests and gate

Real Vue browser fixtures exercise ownership for slots, fragment, teleport, async, KeepAlive and replacement, plus getter/cycle limits and unsupported framework. An intentionally broken story is detected by axe while identical shell issue is excluded; correct story produces no injected fixture violation. Mutate a mounted story so its live SDK and authorized live MCP audits agree on that document, while public Node audit scans the fresh isolated source and returns distinct mode/identity. Exercise Node source replacement, queued/running cancellation, timeout, cleanup failure and missing optional dependency; verify no late result or leaked lane. Prove `project.inspect.aria` and the existing MCP ARIA tool retain their shapes and semantics. Run bounded large-tree tests and current SDK/MCP regressions.
