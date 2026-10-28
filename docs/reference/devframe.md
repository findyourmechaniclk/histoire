# Devframe live inspection

The optional `@histoire/devframe` adapter connects an explicitly mounted Histoire session to a host-owned Devframe instance and an independently authenticated MCP endpoint. It starts no listener or connection on import. This integration exposes live observations; the existing [Histoire MCP server](./mcp.md) continues to run isolated inspection separately.

## Host setup

The host must verify browser credentials and supply its own project, document, and agent authorization policy. The following uses application-owned `policy` and `devframeAuth` objects; their verification methods must not trust client-provided IDs, origins, or trust flags as proof of identity.

```ts
import { createDevframeBridge, createMcpEndpoint } from '@histoire/devframe/node'
import { initDevframe } from 'devframe/initiate'

let authorityVersion = 0
const bridge = createDevframeBridge({
  identifyPeer: session => policy.browserPrincipal(session),
  verifyAttachment: (session, identity, sourceUrl) =>
    policy.verifyDocument(session, identity, sourceUrl),
  isCurrent: (session, identity) => policy.isCurrent(session, identity),
  allowSource: url => policy.allowsBook(url),
  authorize: request => policy.allowsAgent(request),
  authorityVersion: () => authorityVersion,
})
const endpoint = createMcpEndpoint(bridge.broker, request => policy.agentPrincipal(request))

// `server` is the host's HTTP server; install routing before accepting requests.
const instance = initDevframe(bridge.definition, {
  server,
  base: '/tools/histoire/',
  origin: 'https://tools.example.com',
  allowedOrigins: ['https://host.example.com'],
  auth: devframeAuth,
  distDir: false,
  mcp: false,
  register: false,
  onPeerDisconnect: (_connection, meta) => bridge.onPeerDisconnect(meta),
})
await instance.ready
```

`policy.browserPrincipal` must return a stable principal from verified transport credentials. `policy.verifyDocument` must independently verify the exact source and document identity and return `{ identity, scopes }`. `policy.isCurrent` rechecks that authority, and `policy.allowsAgent` checks discovery and each requested scope for the separately authenticated agent. `policy.agentPrincipal` verifies every MCP HTTP request and returns a stable agent principal or `undefined`. Configure `devframeAuth` to authenticate the browser transport; a browser grant does not authenticate an agent.

Route the explicit MCP path to `endpoint.fetch` (or use `toNodeHandler` from `@modelcontextprotocol/node` for Node HTTP). Route Devframe requests to `instance.nodeMiddleware`. For a cross-origin host, configure the host HTTP CORS policy to permit only the exact trusted browser origin to read the Devframe `__connection.json` metadata route, including its nested base path. Configure `allowedOrigins` for the transport separately. Deny other origins and handle the required preflight; CORS is not authentication. The host controls the public origin, HTTP server, paths and listener.

Whenever policy, source or runtime authority changes, increment the revision synchronously and invalidate affected attachments before returning control:

```ts
function authorityChanged(attachmentId?: string) {
  authorityVersion++
  bridge.invalidate(attachmentId) // omit ID to invalidate all
}
```

On shutdown, await `endpoint.close()` and `bridge.dispose()`, then close the caller-owned Devframe instance and HTTP server. Repeated disposal calls join the same cleanup. Disposal waits for peer retirement and rejects if cleanup fails or times out. Neither endpoint nor bridge owns that server. Wire `onPeerDisconnect` as above so disconnect retires the matching attachment.

### Optional host helper

`mountDevframeHost` from `@histoire/devframe/host` can create and manage the Devframe instance and bridge on a caller-owned HTTP or HTTPS server. Use it instead of the preceding `createDevframeBridge` and `initDevframe` setup:

```ts
import { mountDevframeHost } from '@histoire/devframe/host'

const host = await mountDevframeHost({
  server,
  base: '/tools/histoire/',
  origin: 'https://tools.example.com',
  allowedOrigins: ['https://host.example.com'],
  auth: devframeAuth,
  bridge: bridgeOptions, // the verified host policy callbacks described above
})
const bridge = host.bridge
// Route original request URLs through host.nodeMiddleware without stripping the base.
// Configure metadata CORS and the separately authenticated MCP endpoint as above.
await host.dispose()
```

The helper disables automatic MCP, SSE, discovery registration, and static assets. Its base must be dedicated and must not overlap another helper mount on that server. It owns only its registrations and transport; the host still owns the server, middleware installation, credentials, and origin policy. `host.dispose()` is asynchronous and joinable; remove the caller's middleware layer separately when needed.

## Pair an existing session

Enable live inspection and authorize the browser origin in the Histoire source and embedding configuration as described in [live inspection](./sdk.md#live-inspection). Once the host has authenticated the browser, it can create a short-lived, single-use grant bound to its principal, canonical book URL, and permitted scopes:

```ts
const grant = bridge.broker.createGrant({
  principal: browserPrincipal,
  sourceUrl: 'https://books.example.com/stories/',
  scopes: ['inspection', 'events'],
})
// Deliver grant.token to that browser over the host's confidential authenticated channel.
```

Do not place the token in URLs, discovery records, or logs. In the browser, use a connected session with a ready primary mount and a caller-owned authenticated Devframe client:

```ts
import { attachDevframe } from '@histoire/devframe/client'

const attachment = await attachDevframe({
  session,
  connection, // authenticated Devframe RPC client, trusted by the host
  grant: grantToken,
  projectId: 'my-project',
  scopes: ['inspection', 'events'],
})
// The caller retains ownership of session and connection.
await attachment.dispose()
```

Create the Devframe browser RPC client with `webmcp: false`; generic WebMCP registration does not provide this adapter's authenticated agent-principal and per-call authorization. The host verifies `projectId` and document identity independently. Pairing never selects or mounts a story. Granted scopes are intersected with host authorization and available SDK capabilities. Selection, source or document replacement, disconnect, revocation, or disposal retires the attachment. A new visit needs a new grant.

## Agent services

The authenticated agent discovers authorized `histoire://live/` resources. Each call supplies the attachment ID, exact `target`, and `expectedOwner` from its resource. Scope and current authority are checked again for each operation.

| Scope | MCP tool | Purpose |
| --- | --- | --- |
| `inspection` | `histoire_inspect_session` | Bounded variant or DOM observation |
| `events` | `histoire_get_session_events` | Attributed component event history |
| `components` | `histoire_inspect_component` | Available component tree, details, or element owner |
| `accessibility` | `histoire_audit_session_accessibility` | Available bounded axe audit |
| `highlight` | `histoire_highlight_element` | Temporary selector highlight |
| `diagnostics` | `histoire_get_session_diagnostics` | Explicitly observed diagnostics |

Component and audit support depends on the source's opt-in and runtime capabilities. An automated audit does not establish full accessibility compliance. Selector highlight requires the highlight grant; component-ID highlight also requires the components grant and a supported runtime that can identify one story-root element. Diagnostic entries may contain application data; observations are document-wide and should be shared only with authorized agents. Component event history uses `eventLifetime`, sequence cursors, and loss metadata; clearing history invalidates old lifetimes. An events-only grant does not start diagnostic observation.

## Detached reports

`@histoire/devframe/report` exports selected live variant or DOM results as historical JSON data and standalone HTML. It does not write a file or open a connection:

```ts
import { createInspectionReport } from '@histoire/devframe/report'

const { data, html } = createInspectionReport({ results: [variant, dom] })
```

The default report contains summaries and hashed identity values, not state or DOM content. Content requires explicit selections and a caller-provided sanitizer; sanitized data can still be sensitive. Reports accept at most 32 results and have bounded output. They are historical observations, not live sessions.
