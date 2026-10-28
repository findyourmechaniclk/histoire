# Histoire Devframe adapter

This package provides opt-in, authenticated access to an already mounted Histoire session. Importing it starts no listener, connection, event observation or diagnostic instrumentation. The host owns its Histoire session, Devframe instance, HTTP server, credentials and authorization policy.

Start with the [live-inspection guide](../../docs/guide/devframe.md) for installation, source configuration, browser pairing, and MCP calls. See the [adapter reference](../../docs/reference/devframe.md) for API defaults, tool inputs, reports, and troubleshooting.

Packed-consumer and compatibility gates remain part of release verification; no publication is implied by these APIs.

## Host contract

`createDevframeBridge` creates a Devframe definition and a bounded broker. The host installs the definition in a Devframe instance with automatic MCP and shared-state exposure disabled. Pass the Devframe disconnect hook to `bridge.onPeerDisconnect(meta)`; await `bridge.dispose()` when finished. For a cross-origin browser host, explicitly allow that origin for the Devframe transport and allow it to fetch the Devframe `__connection.json` metadata route through the host CORS policy. Disposal joins owned peer retirement acknowledgements and rejects with a generic error if one fails or times out; it never closes the caller's server or connection.

A host must supply all of these callbacks:

- `identifyPeer`: derive a stable browser principal from verified transport credentials. A peer ID, origin, trust flag or browser-provided value alone does not establish identity.
- `verifyAttachment`: authorize the canonical source and resolve the exact document metadata and permitted scopes. Browser claims and project IDs are untrusted inputs, not authority.
- `isCurrent`: check that the captured attachment and its source are still authorized and current.
- `allowSource`: constrain allowed canonical book URLs.
- `authorize`: authorize discovery and each finite scope for the separately authenticated agent principal.
- `authorityVersion`: return a monotonic host-owned revision. Increment it synchronously on every policy, source or runtime authority change, then call `bridge.invalidate(attachmentId)` for a specific attachment or `bridge.invalidate()` for a global change. Invalidation aborts work and retires the browser attachment. Mutable callbacks without revision and invalidation cannot enforce timely revocation.

Create a short-lived one-use grant through `bridge.broker.createGrant`, bound to the browser principal, canonical source and maximum scopes. Deliver its token to the browser through a confidential host channel; do not put it in a URL, discovery metadata or logs. The browser calls `attachDevframe` with its existing connected session and authenticated Devframe client. The SDK must have a ready mounted target; no story is mounted automatically. Await the returned `dispose()` before considering attachment cleanup complete.

`createMcpEndpoint` creates a fetch-shaped handler. The host must route an explicitly configured endpoint to it and authenticate **every** request through the required callback. Return a stable agent principal only after verifying credentials; never derive it from tool arguments. The host owns HTTP origin policy, listener and path routing. Call `endpoint.close()` independently of the host server. Browser and agent authentication are separate.

## Scopes and limits

- `inspection`: finite variant and DOM reads of the exact paired owner. SDK capability and target checks still apply.
- `events`: current SDK-owned component event history, with exact target and runtime attribution. A nonzero cursor needs the returned `eventLifetime`; clearing history invalidates older lifetimes. `droppedCount` and `gap` describe the SDK session history, including events outside the selected target. An events-only attachment does not start diagnostic observation.
- `components`: finite component trees, exact instance details and selector-to-owner lookup when the mounted runtime supports them.
- `accessibility`: bounded axe audit when the mounted runtime supports it.
- `highlight`: temporary selector highlight when source and mounted runtime support highlight and highlight leases. Component-ID highlight additionally requires the `components` scope, authorization for both scopes, and the `componentHighlight` capability. Authorization is checked before and after the action. Neither action changes selection.
- `diagnostics`: starts a shared SDK debug subscription after the grant is accepted. It ends on attachment retirement or disposal. Console and error entries are document-wide observations, not proof that the selected component caused them. Common credential patterns are redacted by the SDK; arbitrary unlabelled secrets may remain.

Inputs, results, pending requests, grants, attachments and leases are bounded. An attachment retains up to 128 highlight leases until their overlay expires, and clears its own leases on retirement. Cleanup is bounded to three seconds; disposal reports incomplete cleanup if it fails or times out. The adapter limits unresolved Devframe operation calls to 64 and unresolved retirement calls to 64 per bridge, retaining each slot until the upstream promise settles. Browser pairing is capped at 32 unresolved attempts per connection; a client timeout retains its slot for an additional 60 seconds because Devframe may still hold the underlying call. Cancellation is sent as a targeted one-way RPC event. Devframe 1.2.2 birpc retains an unanswered RPC internally for its 60-second default timeout; adapter disposal stops waiting at its configured timeout and never closes a caller-owned connection to force that internal state away. Only finite service names are exposed. Existing isolated Histoire MCP services retain their own lifecycle and behavior.

`mountDevframeHost` from `@histoire/devframe/host` optionally mounts the bridge on a caller-owned HTTP or HTTPS server. It requires explicit transport auth, host policy, origin and a dedicated base; install its returned `nodeMiddleware` without stripping that base, and await `dispose()`. Its owned Devframe instance disables automatic MCP, SSE, discovery registration and static assets. Remove the caller's own middleware layer separately if needed. Distinct helpers reject overlapping bases on the same server; external mounts remain the host's responsibility. When creating a Devframe client for this adapter, pass `webmcp: false`: generic WebMCP registration lacks the authenticated agent-principal and per-call authorization seam needed here. A DevTools dock is not advertised without a verified owner-bound host integration.
