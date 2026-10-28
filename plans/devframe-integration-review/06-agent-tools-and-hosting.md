# 06 — Live agent services, MCP and hosting

Depends on 02, 04 and 05. Goal: expose finite explicitly paired live reads to an authenticated agent while preserving existing Histoire MCP and source lifetimes.

## Likely paths

Candidate `packages/histoire-devframe/src/{node/{contracts,discovery,dispatch,registry},shared/services}.ts`; current `packages/histoire/src/node/mcp/{server,protocol,transport,operations}/`; existing MCP HTTP authorization and observer fixtures. Adapter owns its optional endpoint, not the existing endpoint's lifecycle.

## Steps

1. Define a single registry of finite service names, input/output schemas, scope, resource metadata and read/action classification. Implement session discovery, inspection, component event history and diagnostics; add highlight only through explicit action scope. `histoire_get_session_events` reads existing attributed Histoire component events under a distinct `events` grant, not the diagnostics grant. Do not enable console instrumentation for an events-only grant. Never expose arbitrary JS or generic shared-state writes.
2. Implement discovery and resources that return only authorized bounded records for the caller; reauthorize on each list, read and call. Route by exact project, source, session, attachment, peer and applicable bridge identity from slice 01; no broadcast, hidden selection or automatic fresh mount. Annotate live mode and capture source/target identity. For event history, project the current SDK-owned bounded event buffer with exact target/runtime attribution, validated `afterSequence` and `limit`, stable ordering, truncation and explicit dropped/gap information. Bound the complete response including cursor/metadata. Do not synthesize missing events or conflate event loss with debug timeline loss; if a requested event lifetime is unavailable, report it explicitly.
3. Choose transport from refreshed compatibility proof. Historical candidate probes found generic agentic projection lacked principal/cancellation context and raw MCP `isError`; do not assume that remains true. If still true, use a finite MCP SDK server with trusted `authInfo` and actual request cancellation, and disable automatic generic MCP/shared-state exposure. Reject unauthenticated calls before discovery; do not conflate browser pairing with agent authentication.
4. Propagate request cancellation/deadline across server, broker, client and SDK; ignore late results; enforce in-flight and wire budgets and recheck authorization/source owner after every await. Public failures must use compatible structured errors without secrets.
5. Host on an explicitly configured endpoint/middleware. Respect nested base paths and host-owned HTTP/WebSocket listeners, cleanly detach all adapter handlers without closing caller server, and prove no listener appears by default. Existing `histoire_*` isolated endpoint, tool definitions, queues and ARIA behavior remain unchanged.

## Tests and gate

Use real MCP client and HTTP transport plus real Devframe WebSocket client. Prove discovery and finite call with two principals, projects and peers; unauthorized data/resource absence, grant withdrawal mid-call, cancellation reaching runtime, timeout, late reply, bounded input/results, raw structured error, host server survival and adapter disposal. Emit actual story component events and read them through `histoire_get_session_events`: verify scope denial, source/target attribution, chronological pagination and loss after overflow, runtime replacement, byte bounds, and that an events-only grant does not activate diagnostics. Separately run old MCP contract/transport suites. Real browser plus real transport must read an unsaved mounted value, not merely a stubbed peer or fresh isolated document.
