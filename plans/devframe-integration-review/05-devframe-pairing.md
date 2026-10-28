# 05 — Devframe attachment, pairing and live-session broker

Depends on 03; may follow 04 to reuse diagnostics. Goal: make explicit, authenticated pairing available over a real Devframe connection while Histoire remains authority for the mounted document.

## Likely paths

Candidate `packages/histoire-devframe/src/{client,node,shared}/`, especially `node/{grants,registry,dispatch}.ts`, `types.ts`, client entry and integration tests. The candidate public entries are type-only. Inspect current Devframe and agentic APIs at the exact selected versions before designing integration. Update `pnpm-workspace.yaml`, package manifest and lockfile only for actual tested dependency choices.

## Steps

1. Define public Node factory/options and browser attach/dispose APIs with explicit caller-owned Histoire session and authenticated Devframe connection. Document whether host or adapter owns server, socket, registrations and pairing; import alone starts nothing.
2. Derive browser and agent principals from verified host/transport credentials. Use separate authentication mechanisms where needed; neither origin, peer ID, input JSON nor discovery ID proves identity. Provide no implicit common principal. If upstream cannot expose authenticated peer context, use a verified host adapter or fail closed; record the seam and tests.
3. Issue short-lived one-use pairing grants bound to principal, canonical source and explicit scope; store only hashes, enforce size/count/expiry, prevent replay, never place grants in URLs, logs, discovery metadata or result payloads. Intersect configured, source, runtime and authorized scopes.
4. Register a bounded session/attachment record for exact peer with heartbeat and explicit detach/disconnect lifecycle. Capture authority before invocation and reauthorize after every await. Revoke or abort requests on policy change, runtime/source change, disconnect, lease expiry and adapter close; deny discovery without leaking existence.
5. Implement browser connection and targeted RPC with per-operation IDs, timeouts, bounded pending work and cancellation propagation to actual SDK read. Handle late responses, duplicate attach/dispose, peer reuse and same IDs across projects. Dispose only owned registrations/listeners; do not clear the caller's collector registry or close supplied session, HTTP server or socket.

## Tests and gate

Unit tests for grants, replay, expiry, bound and principal isolation; real Devframe WebSocket test with two actual authenticated peers plus denied principal. Hold authorization, dispatch and reply at each boundary while revoking/replacing/disconnecting; neither stale success nor continued work may leak. Exercise cleanup, connection reuse, ownership and redaction. A Node location shim proves WebSocket transport only; real browser attachment is separately required in 06/09.
