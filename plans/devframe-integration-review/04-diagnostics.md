# 04 — Bounded diagnostics and timeline

Depends on 03. Goal: expose useful, opt-in diagnostics for the exact live runtime without destabilizing story behavior or retaining sessions after disposal.

## Likely paths

Candidate `packages/histoire-protocol/src/inspection/debug-buffer.ts`, `packages/histoire-sdk/src/session/debug.ts`, `packages/histoire-shared/src/inspection/`, runtime `debug-service.ts`; current SDK events, workbench event inspector and MCP diagnostics. Reuse existing listeners, sanitizers and DTOs where their contracts match; do not install two competing console patches.

## Steps

1. Inventory current console/error/network/event observers and their ownership. Choose finite supported event categories and explicit start/stop/subscribe operations; exclude credentials, arbitrary object references and unrestricted network bodies.
2. Implement bounded ring buffer with monotonic sequence, cursor, oldest available entry, gap/loss count and bounded per-entry/total bytes. Carry exact runtime owner, source and optional correlation ID. Use a shared redaction/bounds policy with existing diagnostics where appropriate.
3. Attach lazily when enabled and authorized. Reference count or ownership-token listeners so overlapping consumers do not undo each other; preserve prior console handlers and restore only what this integration installed. Stop on session/document replacement, permission revocation, disconnect and explicit disposal; joining an old stop must not terminate a successor.
4. Publish detached snapshots/pages, validate schema and recheck ownership after async delivery. Avoid modifying story state, retrying requests against new runtime or exposing hidden source information.

## Tests and gate

Observe emitted error/events through the public API; prove cursor gaps and overflow, redaction, byte caps and ordering. Exercise overlapping subscribers, reentrant stop/start, previous console replacement, async withdrawal, cancellation and garbage-collectable cleanup. Existing isolated startup diagnostics continue to report failure while retaining captured useful entries. Verify real browser path and record overhead observation with diagnostics disabled and after disposal.
